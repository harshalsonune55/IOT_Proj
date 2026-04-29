import fs from "node:fs/promises";
import path from "node:path";

export function createConfigStore(filePath) {
  async function read() {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  async function write(config) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    return config;
  }

  return {
    read,
    write
  };
}
