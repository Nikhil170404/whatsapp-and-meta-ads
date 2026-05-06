import React from 'react';

export function JsonLd() {
  const websiteSchema = {
    "@type": "WebSite",
    "@id": "https://www.replykaro.in/#website",
    "name": "ReplyKaro",
    "alternateName": ["Reply Karo", "Replykaro.in", "replykaro"],
    "url": "https://www.replykaro.in",
    "publisher": { "@id": "https://www.replykaro.in/#organization" },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://www.replykaro.in/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
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
    "description": "ReplyKaro is India's #1 WhatsApp Business automation and Meta Ads platform for businesses.",
    "foundingDate": "2025",
    "foundingLocation": "Mumbai, Maharashtra, India",
    "areaServed": "Worldwide",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "url": "https://www.replykaro.in/contact",
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
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "1284",
      "bestRating": "5",
      "worstRating": "1"
    },
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "0",
      "highPrice": "299",
      "priceCurrency": "INR",
      "offerCount": "6",
      "offers": [
        { "@type": "Offer", "price": "0", "priceCurrency": "INR", "name": "Free Forever Plan", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "99", "priceCurrency": "INR", "name": "Starter Plan (India)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "299", "priceCurrency": "INR", "name": "Pro Plan (India)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Forever Plan", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "3", "priceCurrency": "USD", "name": "Starter Plan (Global)", "availability": "https://schema.org/InStock" },
        { "@type": "Offer", "price": "9", "priceCurrency": "USD", "name": "Pro Plan (Global)", "availability": "https://schema.org/InStock" }
      ]
    },
    "brand": { "@id": "https://www.replykaro.in/#organization" },
    "description": "ReplyKaro is India's #1 WhatsApp Business automation platform in 2026. It provides keyword auto-replies, template broadcasts, contact CRM, and Meta Ads comment-to-DM automation. Starting at ₹99/mo ($3/mo globally) — 10x cheaper than WATI, Interakt, and AiSensy."
  };

  const faqSchema = {
    "@type": "FAQPage",
    "@id": "https://www.replykaro.in/#faq",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the best WhatsApp Business automation tool in India?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is India's #1 WhatsApp Business automation tool in 2026. It offers keyword auto-replies, template broadcasts, contact CRM, and Meta Ads integration — starting at just ₹99/mo, which is 10x cheaper than WATI and Interakt."
        }
      },
      {
        "@type": "Question",
        "name": "Is ReplyKaro an official WhatsApp API partner?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. ReplyKaro uses the official Meta WhatsApp Business Cloud API. Your account is 100% safe and compliant with Meta's policies. We do NOT use any unofficial or grey-market APIs."
        }
      },
      {
        "@type": "Question",
        "name": "What is the cheapest WATI alternative in India?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the cheapest WATI alternative, starting at ₹99/mo vs WATI's ₹2,499/mo. Both use the official WhatsApp Business API, but ReplyKaro also includes Meta Ads integration for free."
        }
      },
      {
        "@type": "Question",
        "name": "How fast can I set up WhatsApp automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Under 30 seconds! Sign in with Facebook, connect your WhatsApp Business Account, set up a keyword trigger, and your automation goes live instantly. No coding required."
        }
      },
      {
        "@type": "Question",
        "name": "What payment methods does ReplyKaro accept?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro accepts UPI, credit/debit cards, net banking, and wallets via Razorpay for Indian users. International users can pay via credit card in USD."
        }
      },
      {
        "@type": "Question",
        "name": "Does ReplyKaro support Meta Ads automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! ReplyKaro includes a dedicated Meta Ads dashboard where you can connect your Facebook ad accounts, sync campaigns, and automatically send WhatsApp DMs to users who comment on your ads."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free plan?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. ReplyKaro offers a Free Forever plan with 1,000 messages/month and 3 active automations. No credit card required. Upgrade to Starter (₹99/mo) or Pro (₹299/mo) when you need more."
        }
      },
      {
        "@type": "Question",
        "name": "How is ReplyKaro better than Interakt or AiSensy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is 10x cheaper (₹99 vs ₹999/mo), includes Meta Ads integration that competitors don't offer, and provides a faster setup process (under 30 seconds). All platforms use the same official WhatsApp Business API."
        }
      }
    ]
  };

  const siteNavigationSchema = {
    "@type": "SiteNavigationElement",
    "@id": "https://www.replykaro.in/#navigation",
    "name": "Main Navigation",
    "hasPart": [
      { "@type": "WebPage", "name": "WhatsApp Automation", "url": "https://www.replykaro.in/whatsapp" },
      { "@type": "WebPage", "name": "Meta Ads", "url": "https://www.replykaro.in/meta-ads" },
      { "@type": "WebPage", "name": "Pricing", "url": "https://www.replykaro.in/whatsapp#pricing" },
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
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.replykaro.in" },
          { "@type": "ListItem", "position": 2, "name": "WhatsApp Automation", "item": "https://www.replykaro.in/whatsapp" },
          { "@type": "ListItem", "position": 3, "name": "Meta Ads", "item": "https://www.replykaro.in/meta-ads" }
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
