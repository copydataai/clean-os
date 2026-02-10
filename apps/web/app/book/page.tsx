export default function BookPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Organization Link Required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This booking flow now requires an organization-specific link.
          Please use the booking URL in the format <code>/book/&lt;org-slug&gt;</code>.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
