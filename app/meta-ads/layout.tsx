export const metadata = {
  title: "Meta Ads Automation | ReplyKaro",
  description: "Automate your Meta Ads workflows with ReplyKaro. Send direct messages to users who comment on your ad posts.",
};

export default function MetaAdsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1877F2]/5 min-h-screen">
      {children}
    </div>
  );
}
