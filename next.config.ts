import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
<<<<<<< HEAD
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
=======
  typescript: {
    ignoreBuildErrors: false,
  },
  // DEV-01: turbopack removed — webpack callback below would be silently
  // ignored when Turbopack is active, breaking DISABLE_HMR logic.
  allowedDevOrigins: ['ais-dev-kkjpw64w4r7zrsbqo3kfwk-75441031997.asia-southeast1.run.app'],
>>>>>>> 7065542 (Khởi tạo dự án hoặc mô tả thay đổi)
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
