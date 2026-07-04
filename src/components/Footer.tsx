import Image from "next/image";
import SocialLinks from "@/components/SocialLinks";

export default function Footer() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-8 border-t border-white/6 bg-bg-elevated px-5 py-[clamp(28px,4vw,40px)] pt-[clamp(36px,5vw,52px)] sm:px-8 lg:px-14">
      <div>
        <Image
          src="/images/dcf-logo.png"
          alt="DCF"
          width={140}
          height={99}
          className="mb-4 h-10 w-auto"
        />
        <div className="text-[13.5px] leading-[1.9] text-muted">
          Shop # 09 E, Gardinia Market, Bahria Town Lahore
          <br />
          0300-8025248 · 4PM – 2AM daily
        </div>
      </div>
      <SocialLinks size={40} />
    </div>
  );
}
