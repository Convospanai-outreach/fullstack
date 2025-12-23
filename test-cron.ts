import { parseExpression } from "cron-parser";
console.log("Import success");
try {
    const interval = parseExpression('*/5 * * * *');
    console.log('Next:', interval.next().toString());
} catch (err: any) {
    console.error('Error:', err.message);
}
