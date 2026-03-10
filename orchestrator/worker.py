import os
import json
import uuid
import asyncio
from typing import Dict, Any, Callable
# Mocking Redis for this implementation
# In production, use redis-py `redis.asyncio.Redis`
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ConvoSpan.Worker")

# Define our queues (matching spec schema Priority levels)
QUEUES = {
    "critical": "convospan:tasks:critical",
    "high": "convospan:tasks:high",
    "normal": "convospan:tasks:normal",
    "low": "convospan:tasks:low"
}

class MockRedisStream:
    """Mock implementation of a Redis Stream for local testing."""
    def __init__(self):
        self.streams = {q: [] for q in QUEUES.values()}
        
    async def xadd(self, stream: str, fields: Dict[str, str]):
        self.streams[stream].append((str(uuid.uuid4()).encode(), fields))
        logger.debug(f"[REDIS] Added task to stream {stream}")
        
    async def xreadgroup(self, groupname: str, consumername: str, streams: Dict[str, str], count: int = 1, block: int = 2000) -> list:
        # Simulate blocking read
        await asyncio.sleep(0.1) 
        
        results = []
        for stream_name, _ in streams.items():
            if self.streams[stream_name]:
                # Pop the first item for our mock consumer group implementation
                item = self.streams[stream_name].pop(0)
                results.append([stream_name.encode(), [item]])
        return results

    async def xack(self, stream: str, groupname: str, node_id: bytes):
        logger.debug(f"[REDIS] ACK'd message {node_id} on {stream} by group {groupname}")


# Global Mock Instance
redis_client: MockRedisStream = MockRedisStream()

async def push_task_to_queue(task_payload: Dict[str, Any], priority: str = "normal"):
    """API or Orchestrator pushes new tasks onto the appropriate stream."""
    stream_name = QUEUES.get(priority, QUEUES["normal"])
    fields = {
        "id": str(task_payload.get("id", uuid.uuid4())),
        "tenant_id": str(task_payload.get("tenant_id")),
        "task_type": str(task_payload.get("task_type")),
        "payload": json.dumps(task_payload.get("payload", {})),
        "context": json.dumps(task_payload.get("context", {}))
    }
    await redis_client.xadd(stream_name, fields)


class AgentWorkerNode:
    """
    Asynchronous Edge/Cloud Worker processing tasks from Redis Streams.
    It registers itself, implements a heartbeat, and consumes the queue continuously.
    """
    def __init__(self, node_id: str, capabilities: list[str], llm_tier: str):
        self.node_id = node_id
        self.group_name = f"{llm_tier}_workers"
        self.capabilities = capabilities
        self.running = False
        self.handlers: Dict[str, Callable] = {}

    def register_handler(self, task_type: str, handler_func: Callable):
        """Map a capability tag to a specific Python execution function"""
        self.handlers[task_type] = handler_func

    async def start(self):
        self.running = True
        logger.info(f"Worker Node {self.node_id} [{self.group_name}] started listening for exactly: {self.capabilities}")
        
        # Start heartbeat loop in background
        asyncio.create_task(self._heartbeat())
        
        # Start consuming loop
        await self._consume_loop()

    async def stop(self):
        self.running = False
        logger.info(f"Worker Node {self.node_id} shutting down gracefully.")

    async def _heartbeat(self):
        while self.running:
            # Simulate Redis HSET for heartbeat TTL
            logger.debug(f"Heartbeat sent for Node {self.node_id}")
            await asyncio.sleep(10)

    async def _consume_loop(self):
        # We listen to all streams we are allowed to process priority-first
        listen_streams = {QUEUES["critical"]: ">", QUEUES["high"]: ">", QUEUES["normal"]: ">"}
        
        while self.running:
            try:
                # 1. Blocking Read from Redis Stream
                messages = await redis_client.xreadgroup(
                    self.group_name, self.node_id, listen_streams, count=1, block=2000
                )

                if not messages:
                    # Timeout, check again
                    continue

                # 2. Process Message
                for stream, message_list in messages:
                    for msg_id, raw_fields in message_list:
                        # Ensure fields are strings
                        fields = {k if isinstance(k, str) else k.decode(): v if isinstance(v, str) else v.decode() for k, v in raw_fields.items()}
                        
                        task_type = str(fields.get("task_type", ""))
                        task_id = fields.get("id")

                        # 3. Validation: Can this worker handle this task type?
                        if task_type not in self.capabilities:
                            # In production, we'd XACK and push to a DLQ or specific requeue logic if routed wrong.
                            # For now, just logging.
                            logger.warning(f"Task {task_id} requires {task_type}. Node {self.node_id} cannot handle. Ignoring.")
                            continue

                        handler = self.handlers.get(task_type)
                        if not handler:
                            logger.error(f"No handler registered for {task_type} on Node {self.node_id}")
                            continue

                        # 4. Execute Task
                        logger.info(f"Node {self.node_id} claimed Task {task_id} ({task_type}) from {stream.decode()}")
                        try:
                            payload = json.loads(fields.get("payload", "{}"))
                            context = json.loads(fields.get("context", "{}"))
                            
                            # Await the actual agent logic
                            result = await handler(payload, context)
                            
                            logger.info(f"Task {task_id} COMPLETED SUCCESS.")
                            # 5. Acknowledge Success
                            await redis_client.xack(stream.decode(), self.group_name, msg_id)
                            
                            # (Post result back to Orchestrator/DB)

                        except Exception as e:
                            logger.error(f"Task {task_id} FAILED: {str(e)}")
                            # (Trigger Error/Retry Logic)

            except Exception as e:
                logger.error(f"Error in Consumer stream loop: {e}")
                await asyncio.sleep(5)  # Backoff


# --- Example Integration for specific Mock Agents ---

async def handle_pii_extraction(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Mock implementation of the fast local PII Extractor Edge Agent"""
    raw_text = payload.get("text", "")
    logger.info("Executing local ONNX extraction sequence...")
    await asyncio.sleep(0.5) # Simulate local compute latency
    # Here we would call agents.edge.micro_llm
    return {"status": "success", "anonymized_text": raw_text.replace("Email", "[REDACTED]")}

async def handle_playbook_generation(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Mock implementation of the large cloud Gemini Orchestrator"""
    logger.info("Calling out to Gemini 2.0 Flash...")
    await asyncio.sleep(1.5) # Simulate cloud network/inference latency
    return {"status": "success", "steps": [{"action": "email"}]}


# -----------------------------------------------------------------------------
# Test runner for our simulated environments
# -----------------------------------------------------------------------------
async def main():
    logger.info("Spinning up ConvoSpan Workers...")
    
    # Spin up an Edge Node (Fast, local DB/PII access, small capable models)
    edge_node = AgentWorkerNode(node_id="edge-node-001", capabilities=["pii_extraction", "intent_classification"], llm_tier="edge_micro")
    edge_node.register_handler("pii_extraction", handle_pii_extraction)
    
    # Spin up a Cloud Node (Heavy reasoning, synthesis)
    cloud_node = AgentWorkerNode(node_id="cloud-gemini-001", capabilities=["playbook_generation", "complex_reasoning"], llm_tier="cloud_gemini")
    cloud_node.register_handler("playbook_generation", handle_playbook_generation)
    
    # Run loop
    cloud_task = asyncio.create_task(cloud_node.start())
    edge_task = asyncio.create_task(edge_node.start())
    
    # Push test tasks
    await asyncio.sleep(1)
    await push_task_to_queue({"task_type": "pii_extraction", "payload": {"text": "My Email is test@test.com"}}, priority="high")
    await push_task_to_queue({"task_type": "playbook_generation"}, priority="normal")
    
    await asyncio.sleep(3)
    
    await edge_node.stop()
    await cloud_node.stop()

if __name__ == "__main__":
    asyncio.run(main())
