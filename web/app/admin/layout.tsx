export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 px-6 sm:px-8 max-w-7xl xl:mx-auto">
      {children}
    </div>
  );
}
