const image = (id, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
export const demoMe = {
  id: "demo-me",
  username: "you",
  full_name: "Your little corner",
  bio: "Collecting moments, not things.",
  avatar_url: "",
};
export const demoProfiles = [
  {
    id: "mila",
    username: "mila.chen",
    full_name: "Mila Chen",
    bio: "Light, architecture, and slow mornings.",
    avatar_url: image("photo-1534528741775-53994a69daeb", 100),
  },
  {
    id: "james",
    username: "james.wanders",
    full_name: "James Wilson",
    bio: "Taking the scenic route.",
    avatar_url: image("photo-1500648767791-00dcc994a43e", 100),
  },
  {
    id: "sofia",
    username: "sofia.studio",
    full_name: "Sofia Reyes",
    bio: "A little art in the everyday.",
    avatar_url: image("photo-1524504388940-b1c1722653e1", 100),
  },
  {
    id: "leo",
    username: "leo.outside",
    full_name: "Leo Park",
    bio: "Somewhere between the mountains and the sea.",
    avatar_url: image("photo-1506794778202-cad84cf45f1d", 100),
  },
  {
    id: "emma",
    username: "emma.blooms",
    full_name: "Emma Laurent",
    bio: "Flowers, books, and the in-between.",
    avatar_url: image("photo-1517841905240-472988babdf9", 100),
  },
];
export const demoPosts = [
  {
    id: "p1",
    user_id: "mila",
    image_url: image("photo-1493246507139-91e8fad9978e"),
    caption:
      "A place to pause. A little fresh air, a lot of perspective. #slowliving #somewherebeautiful",
    location: "Lago di Braies, Italy",
    likes_count: 248,
    hours: 2,
    comments: [
      {
        id: "c1",
        body: "The kind of view that makes you forget your phone.",
        profile: demoProfiles[1],
      },
    ],
  },
  {
    id: "p2",
    user_id: "sofia",
    image_url: image("photo-1442512595331-e89e73853f31"),
    caption:
      "The best part of a slow morning. Coffee first, everything else can wait. #morningritual",
    location: "A quiet corner, Seoul",
    likes_count: 126,
    hours: 4,
    comments: [],
  },
  {
    id: "p3",
    user_id: "james",
    image_url: image("photo-1470770841072-f978cf4d019e"),
    caption: "No itinerary. Just follow the light. #getoutside #weekend",
    location: "Dolomites, Italy",
    likes_count: 392,
    hours: 6,
    comments: [],
  },
  {
    id: "p4",
    user_id: "emma",
    image_url: image("photo-1490750967868-88aa4486c946"),
    caption: "A little color for your day. #bloom",
    location: "Sunday flower market",
    likes_count: 87,
    hours: 8,
    comments: [],
  },
  {
    id: "p5",
    user_id: "leo",
    image_url: image("photo-1464822759023-fed622ff2c3b"),
    caption: "Small human, big world. Never gets old.",
    location: "Swiss Alps",
    likes_count: 516,
    hours: 12,
    comments: [],
  },
  {
    id: "p6",
    user_id: "mila",
    image_url: image("photo-1476514525535-07fb3b4ae5f1"),
    caption: "Postcards from a day well spent.",
    location: "Lake Como, Italy",
    likes_count: 204,
    hours: 22,
    comments: [],
  },
].map(({ hours, ...post }) => ({
  ...post,
  profile: demoProfiles.find((p) => p.id === post.user_id),
  liked: false,
  saved: false,
  created_at: new Date(Date.now() - hours * 3600000).toISOString(),
}));
export const demoStorageKey = "frame-demo-v1";
export function loadDemo() {
  try {
    const data = JSON.parse(localStorage.getItem(demoStorageKey));
    if (
      data &&
      Array.isArray(data.posts) &&
      Array.isArray(data.following) &&
      data.me?.id === "demo-me"
    )
      return data;
  } catch {
    /* Storage may be unavailable or invalid. Start a fresh demo. */
  }
  return { posts: demoPosts, following: ["mila", "james"], me: demoMe };
}
export function relativeTime(date) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 3600000),
  );
  return hours < 1
    ? "Just now"
    : hours < 24
      ? `${hours}h`
      : `${Math.floor(hours / 24)}d`;
}
