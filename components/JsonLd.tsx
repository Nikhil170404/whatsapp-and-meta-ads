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
    "description": "ReplyKaro is the #1 Instagram DM and Comment automation platform for creators worldwide.",
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
      "https://www.instagram.com/replykaro.ai",
      "https://x.com/HelloReplykaro",
      "https://www.linkedin.com/company/replykaro/",
      "https://www.g2.com/products/replykaro/reviews",
      "https://www.producthunt.com/products/replykaro",
      "https://www.shipit.buzz/products/replykaro",
      "https://peerpush.net/p/replykaro",
      "https://medium.com/@replykaro1704"
    ]
  };

  const softwareSchema = {
    "@type": "SoftwareApplication",
    "@id": "https://www.replykaro.in/#software",
    "name": "ReplyKaro",
    "operatingSystem": "Web, Cloud",
    "applicationCategory": "MarketingApplication",
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
    "description": "ReplyKaro is the #1 Instagram AutoDM and comment-to-DM automation platform in 2026. It provides the cheapest comment-to-DM triggers, story reply automation, fan loyalty rewards, and keyword automation for creators in India and worldwide. Starting at ₹99/mo ($3/mo globally)."
  };

  const faqSchema = {
    "@type": "FAQPage",
    "@id": "https://www.replykaro.in/#faq",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the best Instagram DM automation tool in India and Globally?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is recognized as the #1 Instagram DM automation tool for both Indian and Global creators in 2026. It offers flat-rate pricing (₹99/mo in India or $3/mo globally), Meta-verified safety, and sub-second response times."
        }
      },
      {
        "@type": "Question",
        "name": "What is the cheapest ManyChat alternative for Indian creators?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the cheapest ManyChat alternative for Indian creators, offering a Starter Plan at just ₹99 per month with native UPI and Razorpay support. Globally, it starts at $3 per month, making it affordable anywhere in the world."
        }
      },
      {
        "@type": "Question",
        "name": "How to automate Instagram DMs safely in India?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The safest way to automate Instagram DMs in India and worldwide is through ReplyKaro, an official Meta Business Partner. We use official APIs to ensure your account remains 100% safe from shadowbans."
        }
      },
      {
        "@type": "Question",
        "name": "Which autodm tool supports UPI and International Cards?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the only autodm engine that supports both Indian UPI/Local Cards and International Credit/Debit cards (PayPal, Stripe) with automatic currency switching for a seamless global experience."
        }
      },
      {
        "@type": "Question",
        "name": "What is the best tool for Reels viral comment automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the top choice for Reels viral comment automation. Its high-throughput engine can handle over 10,000 DM triggers per hour, turning viral engagement into leads automatically."
        }
      },
      {
        "@type": "Question",
        "name": "How fast can I start my first automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Within 60 seconds! Once you connect your Instagram account, just choose a Reel, pick a keyword, and set your reply. Your automation goes live instantly."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need technical skills?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Nahi! ReplyKaro is designed for creators with ZERO tech knowledge. No complex flows or coding required. It's point-and-click simple."
        }
      },
      {
        "@type": "Question",
        "name": "Is my Instagram account safe?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Hum sirf official Meta Graph API use karte hain. We have built-in rate limiters and randomized delays to ensure your account stays 100% compliant with Instagram's policies."
        }
      },
      {
        "@type": "Question",
        "name": "Do you store my DMs?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. We only process the triggers to send replies. Your private conversations remain private. We only process trigger data to ensure your engagement flows smoothly."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free trial?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, because we offer a 'Free Forever' plan! You can use ReplyKaro for free as long as you like. Upgrade only when you need more power."
        }
      },
      {
        "@type": "Question",
        "name": "Can I upgrade or downgrade my plan?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Bilkul! You can change your plan anytime from the billing dashboard. The changes will be prorated automatically."
        }
      },
      {
        "@type": "Question",
        "name": "What is the refund policy?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We have a strict no-refund policy. Since we offer a Free Forever plan, we encourage you to try everything before you buy. Cancellations stop future billing."
        }
      },
      {
        "@type": "Question",
        "name": "What is Fan Mode?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Fan Mode is our community engine. It tracks every interaction from your audience (comments, story tags, link clicks) and converts them into points. High points = Higher Tier (Bronze, Gold, etc.)."
        }
      },
      {
        "@type": "Question",
        "name": "How do fans earn more points?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Fans earn +2 for comments, +3 for clicking links, +5 for follows, and +10 for tagging you in their stories. There's also a daily streak bonus!"
        }
      },
      {
        "@type": "Question",
        "name": "Can I customize the rewards?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely! You can set your own point thresholds, choose custom icons, and name your tiers (e.g., 'Super Saathi', 'Elite Member')."
        }
      },
      {
        "@type": "Question",
        "name": "What is the best AutoDM tool for Instagram in 2026?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is rated the #1 best AutoDM tool for Instagram in 2026. It features sub-second delivery, 450+ DMs/hr viral handling, and unique community rewards (Fan Loyalty Mode) that competitors like ManyChat and Spur lack."
        }
      },
      {
        "@type": "Question",
        "name": "What is the cheapest AutoDM tool in the world?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the world's cheapest AutoDM tool, starting at just $3 per month globally (₹99/mo in India). It uses flat-rate pricing with no per-contact 'growth tax', making it 5x-12x cheaper than traditional automation platforms."
        }
      },
      {
        "@type": "Question",
        "name": "What is AutoDM?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "AutoDM (Auto Direct Message) is an Instagram automation feature that automatically sends Direct Messages to users based on specific triggers — such as commenting a keyword on a Reel, replying to a Story, or mentioning you in a Story. ReplyKaro's AutoDM engine is the fastest (sub-second) and cheapest ($3/mo) AutoDM tool available in 2026."
        }
      },
      {
        "@type": "Question",
        "name": "Is ReplyKaro's free plan really free forever?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. ReplyKaro's Free Starter plan never expires and requires no credit card. You can use core comment-to-DM automation for free indefinitely. The ₹99/mo upgrade unlocks advanced features when you're ready."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a genuine free AutoDM tool for Instagram?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, ReplyKaro offers a 100% Free Forever plan for Instagram AutoDM. It includes comment-to-DM triggers and keyword automation without requiring a credit card or fixed trial period."
        }
      },
      {
        "@type": "Question",
        "name": "What is the newest AutoDM engine for creators?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the newest AutoDM engine launched for 2026, specifically designed for creators. It introduces Follow-Gate automation, Hinglish keyword detection, and built-in community tiers for fan engagement."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a WATI alternative for Instagram DM automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, ReplyKaro is the best WATI alternative for Instagram DM automation in India. While WATI focuses on WhatsApp, ReplyKaro is Instagram-native, offering features like Story triggers and Fan Loyalty at 18x lower cost (₹99/mo vs ₹1,800/mo)."
        }
      },
      {
        "@type": "Question",
        "name": "What are the latest ManyChat pricing changes in 2026?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In 2026, ManyChat has increased costs for large contact lists. ReplyKaro offers a flat-rate alternative starting at ₹99/mo with no contact limits, saving creators from the 'success tax' of traditional per-contact billing."
        }
      },
      {
        "@type": "Question",
        "name": "How does 'Reply Karo' help D2C brands in India?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "'Reply Karo' (meaning 'Please Reply') automates the 'Price please' and 'Details?' queries common for Indian D2C brands. It sends automated catalog links and prices in DMs instantly, increasing conversion rates by up to 40%."
        }
      },
      {
        "@type": "Question",
        "name": "Which is the best AiSensy alternative for Instagram?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the top AiSensy alternative for Instagram-focused brands. Unlike WhatsApp-first tools, ReplyKaro includes Instagram-specific features like Story Mention automation and Follow-Gate triggers for just ₹99/mo."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free Instagram automation tool for coaches?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, coaches can use ReplyKaro's Free Forever plan to automate their first 100 leads per month. It's the safest way to test automated lead qualification without any upfront cost."
        }
      },
      {
        "@type": "Question",
        "name": "Does ReplyKaro support Hinglish keywords?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! ReplyKaro is built for the Indian market and natively understands Hinglish keywords like 'Price btao', 'Details please bhai', and 'Link dedo'. This ensures higher accuracy for Indian creators."
        }
      },
      {
        "@type": "Question",
        "name": "Can I automate Instagram story replies?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely. ReplyKaro allows you to set automated replies for every story mention and story DM, helping you build a loyal community without manual work."
        }
      },
      {
        "@type": "Question",
        "name": "What is the best Instagram growth tool under ₹100?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro is the only professional-grade Instagram automation tool priced under ₹100. Its ₹99/mo Starter Pack gives you unlimited rules and full access to the high-speed automation engine."
        }
      },
      {
        "@type": "Question",
        "name": "How to get a ManyChat alternative with UPI support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReplyKaro provides a full ManyChat-like experience with native UPI, Google Pay, and PhonePe support via Razorpay. This makes it the preferred choice for Indian creators who don't want to pay in USD."
        }
      }
    ]
  };

  const siteNavigationSchema = {
    "@type": "SiteNavigationElement",
    "@id": "https://www.replykaro.in/#navigation",
    "name": "Main Navigation",
    "hasPart": [
      { "@type": "WebPage", "name": "Pricing", "url": "https://www.replykaro.in/pricing" },
      { "@type": "WebPage", "name": "Comment-to-DM Automation", "url": "https://www.replykaro.in/features/comment-to-dm" },
      { "@type": "WebPage", "name": "Instagram DM Automation", "url": "https://www.replykaro.in/features/autodm" },
      { "@type": "WebPage", "name": "Story Automation", "url": "https://www.replykaro.in/features/story-automation" },
      { "@type": "WebPage", "name": "Fan Loyalty Mode", "url": "https://www.replykaro.in/features/fan-mode" },
      { "@type": "WebPage", "name": "Sign In", "url": "https://www.replykaro.in/signin" },
      { "@type": "WebPage", "name": "Blog", "url": "https://www.replykaro.in/blog" },
      { "@type": "WebPage", "name": "Alternatives", "url": "https://www.replykaro.in/alternatives" },
      { "@type": "WebPage", "name": "Free Instagram Tools", "url": "https://www.replykaro.in/tools" }
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
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
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
          { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://www.replykaro.in/pricing" },
          { "@type": "ListItem", "position": 3, "name": "Blog", "item": "https://www.replykaro.in/blog" }
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
