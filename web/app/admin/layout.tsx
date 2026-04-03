export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Break out of the root layout's max-w-4xl container to use full width
  return (
    <div
      className="px-6 sm:px-8 lg:px-12"
      style={{
        width: '100vw',
        maxWidth: '1400px',
        marginLeft: '50%',
        transform: 'translateX(-50%)',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}
