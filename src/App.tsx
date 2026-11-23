import React, { useState } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import { TimerProvider, useTimer } from './context/TimerContext';
import { useRouteTab } from './hooks/useRouteTab';
import { TopNavBar } from './components/TopNavBar';
import { BalanceView } from './components/BalanceView';
import { TimerView } from './components/TimerView';
import { ResultModal } from './components/ResultModal';

const ToolkitShell: React.FC = () => {
  const { activeTab, navigate } = useRouteTab();
  const { isFullscreen } = useTimer();
  const { endSession, toastMessage } = useSession();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false);
    void endSession();
  };

  return (
    <div className="safe-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[#FAF8F5] text-[#2C2A25]">
      {!(activeTab === 'timer' && isFullscreen) && (
        <TopNavBar
          activeTab={activeTab}
          onNavigate={navigate}
          onRequestEndSession={() => setConfirmEndOpen(true)}
        />
      )}

      {activeTab === 'balance' ? (
        <BalanceView
          confirmEndOpen={confirmEndOpen}
          onCancelEnd={() => setConfirmEndOpen(false)}
          onConfirmEnd={handleConfirmEnd}
        />
      ) : (
        <TimerView />
      )}

      <ResultModal />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full border border-[#E5DEC9] bg-[#2C2A25]/92 px-4 py-2 text-center text-xs font-medium text-[#FAF8F5] shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SessionProvider>
      <TimerProvider>
        <ToolkitShell />
      </TimerProvider>
    </SessionProvider>
  );
};

export default App;
