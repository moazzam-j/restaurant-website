import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";

export const metadata = {
  title: "Contact — DCF",
};

export default function ContactPage() {
  return (
    <div className="flex flex-wrap gap-[clamp(28px,4vw,56px)] px-5 py-[clamp(28px,4vw,56px)] sm:px-8 lg:px-14">
      <div className="min-w-[280px] flex-1 basis-[380px]">
        <div className="font-display mb-7 text-[clamp(30px,4vw,42px)] tracking-[0.3px] text-text">
          GET IN TOUCH
        </div>

        <div className="mb-3.5 rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-[22px]">
          <div className="mb-2 text-[11.5px] uppercase tracking-[1.2px] text-muted">
            Address
          </div>
          <div className="text-[15px] leading-[1.5] text-text">
            Shop # 09 E, Gardinia Market, Bahria Town Lahore
          </div>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-3.5">
          <div className="flex-1 basis-[140px] rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-[22px]">
            <div className="mb-2 text-[11.5px] uppercase tracking-[1.2px] text-muted">
              Phone
            </div>
            <div className="text-[15px] text-text">0300-8025248</div>
          </div>
          <div className="flex-1 basis-[140px] rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-[22px]">
            <div className="mb-2 text-[11.5px] uppercase tracking-[1.2px] text-muted">
              Hours
            </div>
            <div className="text-[15px] text-text">4:00 PM – 2:00 AM</div>
          </div>
        </div>

        <Link
          href="https://wa.me/923008025248"
          target="_blank"
          rel="noreferrer"
          className="mb-5 flex items-center justify-center gap-2.5 rounded-xl bg-green py-[17px] text-center text-[15.5px] font-extrabold text-[#0B0908] shadow-[0_12px_28px_-10px_rgba(111,168,90,0.45)]"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.446 7.443h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.827 9.827 0 016.99 2.898 9.826 9.826 0 012.895 6.994c-.003 5.45-4.437 9.884-9.889 9.884zm8.413-18.297A11.815 11.815 0 0012.023 0C5.495 0 .188 5.304.185 11.833a11.82 11.82 0 001.581 5.926L0 24l6.395-1.677a11.86 11.86 0 005.622 1.432h.005c6.527 0 11.834-5.304 11.837-11.833a11.77 11.77 0 00-3.42-8.394z" />
          </svg>
          CHAT ON WHATSAPP
        </Link>

        <SocialLinks size={44} />
      </div>

      <div className="min-w-[280px] flex-1 basis-[380px]">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3406.327811432675!2d74.18274197560586!3d31.37752347427969!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMzHCsDIyJzM5LjEiTiA3NMKwMTEnMDcuMSJF!5e0!3m2!1sen!2s!4v1783086300370!5m2!1sen!2s"
          title="DCF — Bahria Town Lahore location"
          width="100%"
          height="280"
          style={{ border: 0 }}
          className="block h-[280px] w-full rounded-[20px]"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
