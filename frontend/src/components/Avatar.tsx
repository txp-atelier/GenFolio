type Props = {
  url: string | null;
  firstName: string;
  lastName: string;
  size?: number;
};

export function Avatar({ url, firstName, lastName, size = 64 }: Props) {
  const style = { width: size, height: size };

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URL, not worth configuring next/image remotePatterns for a small avatar
    return <img src={url} alt="" style={style} className="rounded-full object-cover" />;
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-500 dark:bg-neutral-800"
    >
      {initials}
    </div>
  );
}
