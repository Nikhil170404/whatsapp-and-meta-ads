export const metadata = {
  title: "WhatsApp Automation | ReplyKaro",
  description: "Automate your WhatsApp Business messaging with ReplyKaro. Keyword replies, bulk messaging, and smart chat routing.",
};

export default function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#25D366]/5 min-h-screen">
      {children}
    </div>
  );
}
