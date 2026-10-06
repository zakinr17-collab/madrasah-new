import fs from 'fs';
import mammoth from 'mammoth';

const run = async () => {
    // Just a placeholder, let's see how mammoth handles backslashes
    const result = await mammoth.convertToHtml({ buffer: Buffer.from("dummy") }).catch(e => e.message);
    console.log(result);
};
run();
