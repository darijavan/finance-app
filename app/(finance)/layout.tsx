import { Suspense, type ReactNode } from "react";
import FinanceProvider from "./store";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="app">
          <div className="topbar"><h1>💰 Finance</h1></div>
        </div>
      }
    >
      <FinanceProvider>{children}</FinanceProvider>
    </Suspense>
  );
}
