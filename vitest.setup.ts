import { config } from "dotenv";
import path from "node:path";
import "@testing-library/jest-dom/vitest";

config({ path: path.resolve(__dirname, ".env.local") });
