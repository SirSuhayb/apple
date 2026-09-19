"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { robinhoodChain } from "@/lib/chain";
import { RPC_URL, SITE_URL as CONFIG_SITE_URL } from "@/lib/config";

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "3e2ec2ff129715b1b1433e2298c40efa";

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : CONFIG_SITE_URL.replace(/\/$/, "");

const config = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: "$BITE",
        description: "Eat the apple to the core.",
        url: SITE_URL,
        icons: [`${SITE_URL}/favicon.png`],
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: "$BITE",
      appLogoUrl: `${SITE_URL}/favicon.png`,
    }),
  ],
  transports: {
    [robinhoodChain.id]: http(RPC_URL),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}