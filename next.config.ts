import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "jimp", "pino", "qrcode"],
};

export default nextConfig;
