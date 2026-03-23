export class HardwareConnectionError extends Error {
    constructor(message: string = "Sovereign Node Offline") {
        super(message);
        this.name = "HardwareConnectionError";
    }
}
