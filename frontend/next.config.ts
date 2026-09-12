import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Hides the floating "N" dev-tools badge so demos run from `next dev`
  // look the same as a production build.
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
