type Props = {
  url: string | null;
  firstName: string;
  lastName: string;
  size?: number;
};

export function Avatar({ url, firstName, lastName, size = 64 }: Props) {
  const style = { width: size, height: size };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URL, not worth configuring next/image remotePatterns for a small avatar
      <img
        src={url}
        alt=""
        style={style}
        className="rounded-full border-2 border-surface object-cover shadow-sm"
      />
    );
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full border-2 border-surface bg-surface-muted font-heading font-semibold text-muted-foreground shadow-sm"
    >
      {initials}
    </div>
  );
}
