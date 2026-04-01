export function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-rose-700 sm:text-3xl">Access Denied</h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Access Denied: You are not recognized as a transport operator.
        </p>
        <a
          href="mailto:admin@ai-jeep.local?subject=AI-JEEP%20Operator%20Access%20Request"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 sm:text-base"
        >
          Need help?
        </a>
      </section>
    </main>
  );
}
