import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signin", "/privacy", "/terms", "/data-deletion", "/data-request"],
        disallow: ["/wa/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://www.replykaro.in/sitemap.xml",
  };
}
