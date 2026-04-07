/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    basePath: "/AIchat",
    trailingSlash: true,
    images: { unoptimized: true },
    experimental: {
        optimizePackageImports: ["@untitledui/icons"],
    },
};

export default nextConfig;
