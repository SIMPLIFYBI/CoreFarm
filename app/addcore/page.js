import { redirect } from "next/navigation";

export default async function AddCorePage({ searchParams }) {
	const resolvedSearchParams = await searchParams;
	const params = new URLSearchParams();

	Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((entry) => {
				if (entry != null) params.append(key, String(entry));
			});
			return;
		}

		if (value != null) {
			params.set(key, String(value));
		}
	});

	params.set("tab", "addcore");
	redirect(`/coretasks?${params.toString()}`);
}
