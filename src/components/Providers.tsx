"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { ReferralCapture } from "@/components/ReferralCapture";
import { baseChain } from "@/lib/chain";
import { RPC_URL, SITE_URL as CONFIG_SITE_URL } from "@/lib/config";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ?? "";

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : CONFIG_SITE_URL.replace(/\/$/, "");

if (!WC_PROJECT_ID && typeof window !== "undefined") {
  console.warn(
    "[Providers] NEXT_PUBLIC_WC_PROJECT_ID is unset — WalletConnect connector skipped.",
  );
}

const config = createConfig({
  chains: [baseChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            metadata: {
              name: "$JUICE",
              description: "Squeeze every drop. Revnet-backed on Base.",
              url: SITE_URL,
              icons: [`${SITE_URL}/favicon.png`],
            },
            showQrModal: true,
          }),
        ]
      : []),
    coinbaseWallet({
      appName: "$JUICE",
      appLogoUrl: `${SITE_URL}/favicon.png`,
    }),
  ],
  transports: {
    [baseChain.id]: http(RPC_URL),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ReferralCapture />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
