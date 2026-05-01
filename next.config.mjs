/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: "/auth",
				destination: "/?mode=signin",
				permanent: false,
			},
			{
				source: "/register",
				destination: "/?flow=setup",
				permanent: false,
			},
		];
	},
};

export default nextConfig;
