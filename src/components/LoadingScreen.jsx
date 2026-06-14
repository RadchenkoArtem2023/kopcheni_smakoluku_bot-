export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src="/logo.svg" alt="Копчені Смаколики" className="loading-logo" />
      <div className="loading-spinner" />
      <p className="loading-text">Завантаження...</p>
    </div>
  );
}
