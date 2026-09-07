import { supabase } from "./supabase.js";

const PROFILE_FIELDS = "id,username,full_name,avatar_url,bio";
const COMMENT_FIELDS =
  "id,body,created_at,profile:profiles!comments_user_id_fkey(id,username,full_name,avatar_url)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BUCKET = "post-images";

function client() {
  if (!supabase)
    throw new Error(
      "Configure VITE_SUPABASE_URL and a public Supabase publishable/anon key, then restart the app.",
    );
  return supabase;
}

function id(value, label = "User") {
  if (typeof value !== "string" || !UUID.test(value))
    throw new Error(
      label + " ID is invalid. Refresh the page and sign in again.",
    );
  return value.toLowerCase();
}

function text(value, label, max, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new Error(label + " must be text.");
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(label + " cannot be empty.");
  if ([...trimmed].length > max)
    throw new Error(label + " must be " + max + " characters or fewer.");
  return trimmed;
}

function fail(error, action) {
  if (!error) return;
  if (error.code === "23505")
    throw new Error(
      action +
        ": this username or relationship already exists. Refresh and try again.",
    );
  if (error.code === "23514")
    throw new Error(
      action +
        ": a value exceeds a database limit or uses a reserved username. Check the text and try again.",
    );
  if (error.code === "23503")
    throw new Error(
      action +
        ": the post or profile no longer exists. Refresh the feed; for a new account, verify the profile-creation trigger was installed before signup.",
    );
  if (error.code === "42501" || error.status === 403)
    throw new Error(
      action +
        ": permission denied. Sign in as the owner and check the migration/RLS policies.",
    );
  if (["42P01", "PGRST205", "PGRST200"].includes(error.code))
    throw new Error(
      action +
        ": database setup is missing. Apply the initial Supabase migration and refresh the schema cache.",
    );
  throw new Error(
    action +
      ": " +
      (error.message || "Request failed. Check your connection and try again."),
  );
}

async function authenticated(userId) {
  const user = id(userId);
  const db = client();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new Error("Your session has expired. Sign in again to continue.");
  if (data.user.id.toLowerCase() !== user)
    throw new Error("You can only change your own account data.");
  return { db, user };
}

export async function getProfile(userId) {
  const { data, error } = await client()
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", id(userId))
    .maybeSingle();
  fail(error, "Could not load profile");
  return data;
}

export async function getProfiles() {
  const { data, error } = await client()
    .from("profiles")
    .select(PROFILE_FIELDS)
    .order("username")
    .limit(100);
  fail(error, "Could not load profiles");
  return data ?? [];
}

export async function getFollowing(userId) {
  if (!userId) return [];
  const { data, error } = await client()
    .from("follows")
    .select("following_id")
    .eq("follower_id", id(userId))
    .order("created_at", { ascending: false })
    .limit(1000);
  fail(error, "Could not load following");
  return (data ?? []).map((row) => row.following_id);
}

// MVP limits: newest 50 posts, latest 30 comments per post (displayed oldest first).
// Embedded count aggregates count all visible likes, not just a sampled list.
export async function getFeed(userId) {
  const db = client();
  const viewer = userId ? id(userId) : null;
  const { data, error } = await db
    .from("posts")
    .select(
      "id,user_id,image_url,caption,location,created_at,profile:profiles!posts_user_id_fkey(" +
        PROFILE_FIELDS +
        "),likes(count),comments(" +
        COMMENT_FIELDS +
        ")",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50)
    .order("created_at", { referencedTable: "comments", ascending: false })
    .limit(30, { referencedTable: "comments" });
  fail(error, "Could not load posts");
  const posts = data ?? [];
  let liked = new Set();
  let saved = new Set();
  if (viewer && posts.length) {
    const postIds = posts.map((post) => post.id);
    const [likesResult, savesResult] = await Promise.all([
      db
        .from("likes")
        .select("post_id")
        .eq("user_id", viewer)
        .in("post_id", postIds),
      db
        .from("saves")
        .select("post_id")
        .eq("user_id", viewer)
        .in("post_id", postIds),
    ]);
    fail(likesResult.error, "Could not load your likes");
    fail(savesResult.error, "Could not load your saved posts");
    liked = new Set((likesResult.data ?? []).map((row) => row.post_id));
    saved = new Set((savesResult.data ?? []).map((row) => row.post_id));
  }
  return posts.map(({ likes, comments, ...post }) => ({
    ...post,
    likes_count: Number(likes?.[0]?.count ?? 0),
    liked: liked.has(post.id),
    saved: saved.has(post.id),
    comments: [...(comments ?? [])].reverse(),
  }));
}

async function togglePostRelationship(table, postId, userId, current) {
  if (typeof current !== "boolean")
    throw new Error("Current relationship state must be true or false.");
  const { db, user } = await authenticated(userId);
  const post = id(postId, "Post");
  const result = current
    ? await db.from(table).delete().eq("post_id", post).eq("user_id", user)
    : await db
        .from(table)
        .upsert(
          { post_id: post, user_id: user },
          { onConflict: "post_id,user_id", ignoreDuplicates: true },
        );
  fail(result.error, "Could not update " + table);
  return !current;
}

export async function toggleLike(postId, userId, currentlyLiked) {
  return togglePostRelationship("likes", postId, userId, currentlyLiked);
}

export async function toggleSave(postId, userId, currentlySaved) {
  return togglePostRelationship("saves", postId, userId, currentlySaved);
}

export async function addComment(postId, userId, body) {
  const value = text(body, "Comment", 1000, true);
  const { db, user } = await authenticated(userId);
  const { data, error } = await db
    .from("comments")
    .insert({ post_id: id(postId, "Post"), user_id: user, body: value })
    .select(COMMENT_FIELDS)
    .single();
  fail(error, "Could not add comment");
  return data;
}

export async function toggleFollow(targetId, userId, currentlyFollowing) {
  if (typeof currentlyFollowing !== "boolean")
    throw new Error("Current following state must be true or false.");
  const { db, user } = await authenticated(userId);
  const target = id(targetId, "Profile");
  if (target === user) throw new Error("You cannot follow yourself.");
  const result = currentlyFollowing
    ? await db
        .from("follows")
        .delete()
        .eq("follower_id", user)
        .eq("following_id", target)
    : await db
        .from("follows")
        .upsert(
          { follower_id: user, following_id: target },
          { onConflict: "follower_id,following_id", ignoreDuplicates: true },
        );
  fail(result.error, "Could not update following");
  return !currentlyFollowing;
}

export async function createPost(
  userId,
  file,
  { caption = "", location = "" } = {},
) {
  const captionText = text(caption, "Caption", 2200);
  const locationText = text(location, "Location", 100);
  if (typeof File === "undefined" || !(file instanceof File))
    throw new Error("Choose a photo to upload.");
  if (!IMAGE_TYPES[file.type])
    throw new Error(
      "Choose a JPEG, PNG, WebP, or GIF image. SVG and HEIC are not supported.",
    );
  if (!file.size || file.size > MAX_FILE_SIZE)
    throw new Error(
      "Your image must be larger than 0 bytes and no more than 5 MB.",
    );
  const { db, user } = await authenticated(userId);
  const objectPath =
    user + "/" + crypto.randomUUID() + "." + IMAGE_TYPES[file.type];
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  fail(
    uploadError,
    "Photo upload failed. Check that the post-images bucket and storage policies exist",
  );
  const { data: publicData } = db.storage.from(BUCKET).getPublicUrl(objectPath);
  const { data, error } = await db
    .from("posts")
    .insert({
      user_id: user,
      image_url: publicData.publicUrl,
      caption: captionText,
      location: locationText,
    })
    .select("id,user_id,image_url,caption,location,created_at")
    .single();
  if (error) {
    const { error: cleanupError } = await db.storage
      .from(BUCKET)
      .remove([objectPath]);
    if (cleanupError)
      throw new Error(
        "The post was not published and the uploaded image could not be cleaned up. Remove the unused image from your post-images folder in Supabase Storage, then retry.",
      );
    fail(error, "Could not publish post");
  }
  return data;
}

export async function updateProfile(userId, { full_name, username, bio }) {
  const values = {
    full_name: text(full_name, "Name", 80),
    username: text(username, "Username", 40, true).toLowerCase(),
    bio: text(bio, "Bio", 150),
  };
  if (!/^[a-z0-9_]{3,40}$/.test(values.username))
    throw new Error(
      "Username must be 3–40 lowercase letters, numbers, or underscores.",
    );
  const { db, user } = await authenticated(userId);
  if (
    /^user_[0-9a-f]{32}$/.test(values.username) &&
    values.username !== "user_" + user.replace(/-/g, "")
  )
    throw new Error(
      "That generated username is reserved for another account. Choose a different username.",
    );
  const { data, error } = await db
    .from("profiles")
    .update(values)
    .eq("id", user)
    .select(PROFILE_FIELDS)
    .single();
  fail(error, "Could not update profile");
  return data;
}

// Never trust a caller-supplied URL for deletion. Use the stored URL, verify the
// configured storage origin, then restrict removal to this user's generated key.
export async function deletePost(postId, userId, imageUrl) {
  const { db, user } = await authenticated(userId);
  const post = id(postId, "Post");
  const { data: existing, error: lookupError } = await db
    .from("posts")
    .select("id,image_url")
    .eq("id", post)
    .eq("user_id", user)
    .maybeSingle();
  fail(lookupError, "Could not find your post");
  if (!existing)
    throw new Error("This post no longer exists or you do not own it.");
  if (imageUrl && imageUrl !== existing.image_url)
    throw new Error(
      "The photo URL changed. Refresh the feed before deleting this post.",
    );
  let objectPath = null;
  try {
    const base = new URL(
      db.storage.from(BUCKET).getPublicUrl("").data.publicUrl,
    );
    const stored = new URL(existing.image_url);
    const prefix = base.pathname.endsWith("/")
      ? base.pathname
      : base.pathname + "/";
    if (stored.origin === base.origin && stored.pathname.startsWith(prefix)) {
      const candidate = decodeURIComponent(
        stored.pathname.slice(prefix.length),
      );
      const parts = candidate.split("/");
      if (
        parts.length === 2 &&
        parts[0] === user &&
        /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(parts[1]) &&
        UUID.test(parts[1].split(".")[0])
      )
        objectPath = candidate;
    }
  } catch {
    /* External/malformed URLs are never sent to storage deletion. */
  }
  const { data: removed, error } = await db
    .from("posts")
    .delete()
    .eq("id", post)
    .eq("user_id", user)
    .select("id");
  fail(error, "Could not delete post");
  if (!removed?.length)
    throw new Error("No post was deleted. Refresh and try again.");
  if (objectPath) {
    const { error: storageError } = await db.storage
      .from(BUCKET)
      .remove([objectPath]);
    if (storageError)
      return {
        id: post,
        deleted: true,
        imageRemoved: false,
        warning:
          "Post deleted, but photo cleanup failed. Contact the app administrator to remove its storage image.",
      };
  }
  return { id: post, deleted: true, imageRemoved: Boolean(objectPath) };
}
