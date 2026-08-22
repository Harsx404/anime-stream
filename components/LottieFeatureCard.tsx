"use client";

import dynamic from "next/dynamic";

// Use dynamic import for Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface FeatureCardProps {
  title: string;
  desc: string;
  lottieSrc: any;
}

export default function LottieFeatureCard({ title, desc, lottieSrc }: FeatureCardProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--ring)",
        padding: "32px 24px",
        cursor: "default"
      }}
    >
      <div style={{ width: 64, height: 64, marginBottom: 16 }}>
        <Lottie 
          animationData={lottieSrc} 
          loop={true}
          autoplay={true}
          style={{ width: "100%", height: "100%" }} 
        />
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#fff",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}
