import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/whatsapp", "/meta-ads", "/signin", "/privacy", "/terms", "/data-deletion"],
        disallow: ["/wa/", "/ads/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://www.replykaro.in/sitemap.xml",
  };
}
