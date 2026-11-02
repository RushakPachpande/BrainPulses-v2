export function PortalBrand({ onHome }: { onHome?: () => void }) {
  if (!onHome) {
    return (
      <div className="brand">
        <img src="/brand.svg" alt="" />
        <span>BrainPulses</span>
      </div>
    );
  }
  return (
    <button className="brand" type="button" onClick={onHome}>
      <img src="/brand.svg" alt="" />
      <span>BrainPulses</span>
    </button>
  );
}
