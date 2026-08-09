import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastContainer } from "@/components/common/ToastContainer";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { router } from "@/routes/router";
import { RouterProvider } from "react-router-dom";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
