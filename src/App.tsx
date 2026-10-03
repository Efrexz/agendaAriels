import { BookingWizard } from "./components/BookingWizard";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <main className="min-h-screen">
      <ErrorBoundary>
        <BookingWizard />
      </ErrorBoundary>
    </main>
  );
}

export default App;