import os
import yaml
import torch
from datasets import load_dataset, Dataset
from trl import SFTTrainer
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

def format_instruction(sample):
    """
    Formats the input for Phi-3 Instruct.
    Structure: <|user|>\n{INPUT}\nConstraints: {CONSTRAINTS}<|end|>\n<|assistant|>\n{OUTPUT}<|end|>
    """
    inputs = sample['input']
    constraints = str(sample['constraints'])
    output = sample['output']
    
    prompt = f"<|user|>\n{inputs}\nConstraints: {constraints}<|end|>\n<|assistant|>\n{output}<|end|>"
    return {"text": prompt}

def train():
    # 1. Load Config
    with open("training/train_config.yaml", "r") as f:
        config = yaml.safe_load(f)

    print(f"Loading Base Model: {config['model']['name']}")

    # 2. Prepare Model (Quantized for training efficiency)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    model = AutoModelForCausalLM.from_pretrained(
        config['model']['name'],
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    
    tokenizer = AutoTokenizer.from_pretrained(
        config['model']['name'], 
        trust_remote_code=True
    )
    tokenizer.pad_token = tokenizer.unk_token # Phi-3 quirk handling

    # 3. Apply LoRA
    model = prepare_model_for_kbit_training(model)
    peft_config = LoraConfig(
        r=config['lora']['r'],
        lora_alpha=config['lora']['alpha'],
        lora_dropout=config['lora']['dropout'],
        bias=config['lora']['bias'],
        task_type=config['lora']['task_type'],
        target_modules=config['lora']['target_modules']
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 4. Load & Format Data
    data_files = {}
    data_dir = "training/data"
    for filename in os.listdir(data_dir):
        if filename.endswith(".jsonl"):
            data_files[filename.split('.')[0]] = os.path.join(data_dir, filename)

    print(f"Found datasets: {list(data_files.keys())}")
    
    # Load all jsonl files
    datasets = []
    for name, path in data_files.items():
        ds = load_dataset('json', data_files=path, split='train')
        datasets.append(ds)
    
    # Merge
    full_dataset = torch.utils.data.ConcatDataset(datasets) if len(datasets) > 1 else datasets[0]
    # Convert back to HF Dataset for mapping (ConcatDataset is PyTorch object)
    # Ideally efficient merge, but for this scale list comprehension is fine
    all_data = []
    for ds in datasets:
        for item in ds:
            all_data.append(item)
    
    full_dataset = Dataset.from_list(all_data)
    
    # Format
    formatted_dataset = full_dataset.map(format_instruction)

    # 5. Training Arguments
    training_args = TrainingArguments(
        output_dir=config['training']['output_dir'],
        num_train_epochs=config['training']['epochs'],
        per_device_train_batch_size=config['training']['batch_size'],
        gradient_accumulation_steps=config['training']['grad_accumulation_steps'],
        learning_rate=float(config['training']['learning_rate']),
        logging_steps=config['training']['logging_steps'],
        save_strategy=config['training']['save_strategy'],
        fp16=False,
        bf16=True, # Recommended for Phi-3
        optim=config['training']['optimizer'],
        lr_scheduler_type=config['training']['lr_scheduler'],
        seed=config['training']['seed'],
        report_to="none" # No integration logger
    )

    # 6. Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=formatted_dataset,
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=config['training']['max_seq_len'],
        tokenizer=tokenizer,
        args=training_args,
    )

    # 7. Train
    print("Starting Training...")
    trainer.train()

    # 8. Save
    print(f"Saving adapters to {config['training']['output_dir']}")
    trainer.save_model()

if __name__ == "__main__":
    train()
