import React from 'react';
import { FAQS } from '@/lib/landing-faqs';

export function JsonLd() {
  const websiteSchema = {
    "@type": "WebSite",
    "@id": "https://www.replykaro.in/#website",
    "name": "ReplyKaro",
    "alternateName": ["Reply Karo", "Replykaro.in", "replykaro"],
    "url": "https://www.replykaro.in",
    "publisher": { "@id": "https://www.replykaro.in/#organization" }
  };

  const organizationSchema = {
    "@type": "Organization",
    "@id": "https://www.replykaro.in/#organization",
    "name": "ReplyKaro",
    "url": "https://www.replykaro.in",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.replykaro.in/logo.png",
      "width": 512,
      "height": 512
    },
    "description": "ReplyKaro is a WhatsApp Business automation platform for businesses worldwide.",
    "foundingDate": "2025",
    "foundingLocation": "Mumbai, Maharashtra, India",
    "areaServed": "Worldwide",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "hello@replykaro.in"
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "B-302, Lodha Bellissimo",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "postalCode": "400011",
      "addressCountry": "IN"
    },
    "sameAs": [
      "https://wellfound.com/company/replykaro",
      "https://x.com/HelloReplykaro",
      "https://www.linkedin.com/company/replykaro/",
      "https://www.g2.com/products/replykaro/reviews",
      "https://www.producthunt.com/products/replykaro"
    ]
  };

  const softwareSchema = {
    "@type": "SoftwareApplication",
    "@id": "https://www.replykaro.in/#software",
    "name": "ReplyKaro",
    "operatingSystem": "Web, Cloud",
    "applicationCategory": "BusinessApplication",
    "author": { "@id": "https://www.replykaro.in/#organization" },
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "0",
      "highPrice": "1999",
      "priceCurrency": "INR",
      "offerCount": "6",
      "offers": [
        { "@type": "Offer", "price": "0", "priceCurrency": "INR", "name": "Free Starter Plan", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "999", "priceCurrency": "INR", "name": "Growth Plan (India)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "1999", "priceCurrency": "INR", "name": "Pro Plan (India)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Starter Plan", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "12", "priceCurrency": "USD", "name": "Growth Plan (Global)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "24", "priceCurrency": "USD", "name": "Pro Plan (Global)", "availability": "https://schema.org/InStock" }
      ]
    },
    "brand": { "@id": "https://www.replykaro.in/#organization" },
    "description": "ReplyKaro automates WhatsApp Business: keyword auto-replies, template broadcasts, a shared inbox and consent tracking on the official WhatsApp Cloud API. Free plan available."
  };

  const faqSchema = {
    "@type": "FAQPage",
    "@id": "https://www.replykaro.in/#faq",
    "mainEntity": FAQS.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  const siteNavigationSchema = {
    "@type": "SiteNavigationElement",
    "@id": "https://www.replykaro.in/#navigation",
    "name": "Main Navigation",
    "hasPart": [
      { "@type": "WebPage", "name": "Pricing", "url": "https://www.replykaro.in/#pricing" },
      { "@type": "WebPage", "name": "Sign In", "url": "https://www.replykaro.in/signin" },
      { "@type": "WebPage", "name": "Privacy Policy", "url": "https://www.replykaro.in/privacy" },
      { "@type": "WebPage", "name": "Terms of Service", "url": "https://www.replykaro.in/terms" }
    ]
  };

  const localBusinessSchema = {
    "@type": "LocalBusiness",
    "@id": "https://www.replykaro.in/#localbusiness",
    "name": "ReplyKaro",
    "image": "https://www.replykaro.in/logo.png",
    "url": "https://www.replykaro.in",
    "telephone": "+91-9987568422",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "B-302, Lodha Bellissimo",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "postalCode": "400011",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 18.9934,
      "longitude": 72.8335
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    }
  };

  const consolidatedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      websiteSchema,
      organizationSchema,
      softwareSchema,
      faqSchema,
      siteNavigationSchema,
      localBusinessSchema,
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.replykaro.in/#breadcrumb",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.replykaro.in" }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(consolidatedSchema) }}
    />
  );
}
