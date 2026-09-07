import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Grid3X3,
  Heart,
  Home,
  ImagePlus,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import * as api from "./lib/api";
import {
  demoProfiles,
  demoStorageKey,
  loadDemo,
  relativeTime,
} from "./lib/demo";
import "./App.css";

function Avatar({ person, size = "", ring = false }) {
  return (
    <span className={`avatar ${size} ${ring ? "ring" : ""}`}>
      {person?.avatar_url ? (
        <img
          src={person.avatar_url}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span>
          {(person?.full_name || person?.username || "You")
            .slice(0, 1)
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}
function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusables = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), input, textarea, a[href], [tabindex="0"]',
          ),
        ];
        const first = focusables[0],
          last = focusables.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function PostCard({
  post,
  me,
  onLike,
  onSave,
  onComment,
  onProfile,
  onShare,
  onDelete,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(compact);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!comment.trim() || sending) return;
    setSending(true);
    try {
      await onComment(post.id, comment.trim());
      setComment("");
      setExpanded(true);
    } catch {
      /* The parent reports the error; keep the comment for retry. */
    } finally {
      setSending(false);
    }
  };
  return (
    <article className={`post-card ${compact ? "compact" : ""}`}>
      <div className="post-head">
        <button
          className="person-button"
          onClick={() => onProfile(post.profile)}
        >
          <Avatar person={post.profile} />
          <span>
            <strong>{post.profile?.username || "creator"}</strong>
            <small>{post.location || "A moment worth sharing"}</small>
          </span>
        </button>
        <div className="post-head-right">
          <time dateTime={post.created_at}>
            {relativeTime(post.created_at)}
          </time>
          {post.user_id === me?.id && (
            <button
              className="text-button delete-button"
              onClick={() => onDelete(post)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div
        className="post-photo"
        onDoubleClick={() => !post.liked && onLike(post)}
      >
        <img
          src={post.image_url}
          alt={post.caption || `Photo by ${post.profile?.username}`}
          loading={compact ? "eager" : "lazy"}
        />
        <span className="photo-label">
          <MapPin size={12} /> {post.location || "In the moment"}
        </span>
      </div>
      <div className="post-body">
        <div className="post-actions">
          <div>
            <button
              className={`icon-button ${post.liked ? "liked" : ""}`}
              onClick={() => onLike(post)}
              aria-label={`${post.liked ? "Unlike" : "Like"} post by ${post.profile?.username}`}
              aria-pressed={post.liked}
            >
              <Heart fill={post.liked ? "currentColor" : "none"} />
            </button>
            <button
              className="icon-button"
              onClick={() => setExpanded(!expanded)}
              aria-label="Show comments"
              aria-expanded={expanded}
            >
              <MessageCircle />
            </button>
            <button
              className="icon-button"
              onClick={() => onShare(post)}
              aria-label="Copy post link"
            >
              <Send />
            </button>
          </div>
          <button
            className={`icon-button ${post.saved ? "saved" : ""}`}
            onClick={() => onSave(post)}
            aria-label={post.saved ? "Unsave post" : "Save post"}
            aria-pressed={post.saved}
          >
            <Bookmark fill={post.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <strong className="like-count">
          {post.likes_count.toLocaleString()} likes
        </strong>
        <p className="caption">
          <button onClick={() => onProfile(post.profile)}>
            {post.profile?.username}
          </button>{" "}
          {post.caption}
        </p>
        <button
          className="comments-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {post.comments.length
            ? `View ${expanded ? "fewer" : `all ${post.comments.length}`} comments`
            : "Start the conversation"}
        </button>
        {expanded && (
          <div className="comments-list">
            {post.comments.map((c) => (
              <p key={c.id}>
                <strong>{c.profile?.username || "creator"}</strong> {c.body}
              </p>
            ))}
          </div>
        )}
        <form className="comment-form" onSubmit={submit}>
          <Avatar person={me} size="tiny" />
          <input
            aria-label={`Comment on ${post.profile?.username}'s post`}
            placeholder="Leave a little kindness…"
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button type="submit" disabled={!comment.trim() || sending}>
            {sending ? "…" : "Post"}
          </button>
        </form>
      </div>
    </article>
  );
}
function CreatePost({ onSubmit, me }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [caption, setCaption] = useState(""),
    [location, setLocation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const pick = (f) => {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        f.type,
      ) ||
      f.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG, WebP, or GIF under 5 MB.");
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  return (
    <form
      className="create-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(file, { caption, location });
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label
        className={`upload-area ${preview ? "has-image" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <img src={preview} alt="Your photo preview" />
        ) : (
          <>
            <span className="upload-icon">
              <ImagePlus size={34} />
            </span>
            <h3>Every photo has a story.</h3>
            <p>Drop yours here, or browse your files</p>
            <span className="button secondary">Choose a photo</span>
            <small>JPG, PNG, WebP, GIF · Up to 5 MB</small>
          </>
        )}
        <input
          type="file"
          aria-label="Choose a photo"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => pick(e.target.files[0])}
        />
      </label>
      {preview && (
        <p className="muted small">
          Click the image to choose a different photo.
        </p>
      )}
      <div className="person-line">
        <Avatar person={me} size="tiny" />
        <strong>{me.username}</strong>
      </div>
      <label>
        Caption
        <textarea
          placeholder="What's the story behind this moment?"
          value={caption}
          maxLength={2200}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />
      </label>
      <label>
        Location <span className="muted">(optional)</span>
        <input
          placeholder="Somewhere lovely"
          maxLength={100}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={!file || busy}>
        {busy ? (
          <>
            <LoaderCircle className="spin" size={17} /> Sharing…
          </>
        ) : (
          <>
            Share your moment <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
function AuthForm({ onComplete }) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
          if (!supabase)
            throw new Error(
              "This preview is not connected yet. Set the Supabase environment variables to enable accounts.",
            );
          let result;
          if (mode === "signup")
            result = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: name },
                emailRedirectTo: window.location.origin,
              },
            });
          else
            result = await supabase.auth.signInWithPassword({
              email,
              password,
            });
          if (result.error) throw result.error;
          if (result.data.session) onComplete();
          else
            setMessage(
              "Check your email to confirm your account, then sign in here.",
            );
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="auth-intro">
        <Camera size={32} />
        <h3>
          {mode === "login"
            ? "Your people. Your moments."
            : "Make room for a little more life."}
        </h3>
        <p>
          A photo-sharing community, inspired by Instagram.
          <br />
          Use a new Frame account, not your Instagram password.
        </p>
      </div>
      {mode === "signup" && (
        <label>
          Your name
          <input
            required
            maxLength={80}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
      <label>
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <button
        className="button primary full"
        disabled={busy || !isSupabaseConfigured}
      >
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>
      <button
        className="text-button full"
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
      {!isSupabaseConfigured && (
        <p className="muted small">
          Accounts are unavailable in this local preview. All demo features work
          without signing in.
        </p>
      )}
    </form>
  );
}
function EditProfile({ me, onSubmit }) {
  const [values, setValues] = useState({
      full_name: me.full_name || "",
      username: me.username || "",
      bio: me.bio || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit(values);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Avatar person={me} size="large" />
      {[
        ["full_name", "Full name", 80],
        ["username", "Username", 40],
        ["bio", "Bio", 150],
      ].map(([key, label, max]) => (
        <label key={key}>
          {label}
          <input
            value={values[key]}
            required={key !== "bio"}
            maxLength={max}
            minLength={key === "username" ? 3 : undefined}
            pattern={key === "username" ? "[a-z0-9_]+" : undefined}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
        </label>
      ))}
      <p className="muted small">
        Usernames use 3–40 lowercase letters, numbers, and underscores.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export default function App() {
  const [demoData, setDemoData] = useState(loadDemo);
  const [user, setUser] = useState(null),
    [demo, setDemo] = useState(true),
    [posts, setPosts] = useState([]),
    [people, setPeople] = useState([]),
    [profile, setProfile] = useState(null),
    [following, setFollowing] = useState([]);
  const [view, setView] = useState("Home"),
    [feedTab, setFeedTab] = useState("For you"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [selectedProfile, setSelectedProfile] = useState(null),
    [selectedPost, setSelectedPost] = useState(null),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [pendingDelete, setPendingDelete] = useState(null);
  const pending = useRef(new Set()),
    noticeTimer = useRef(null),
    authUserRef = useRef(null),
    authRevision = useRef(0);
  const me = demo
    ? demoData.me
    : profile || {
        id: user?.id,
        username: "you",
        full_name: "Your profile",
        avatar_url: "",
      };
  const activePosts = demo ? demoData.posts : posts,
    activePeople = demo
      ? demoProfiles.map((p) => (p.id === demoData.me.id ? demoData.me : p))
      : people,
    activeFollowing = demo ? demoData.following : following;
  const notify = useCallback((text) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }, []);
  const closeModal = useCallback(() => {
    setModal(null);
    setPendingDelete(null);
  }, []);
  const refresh = useCallback(async (id) => {
    if ((id || null) !== authUserRef.current) return;
    const revision = ++authRevision.current;
    setLoading(true);
    setLoadError("");
    try {
      const [feed, profiles, ownProfile, follows] = await Promise.all([
        api.getFeed(id),
        api.getProfiles(),
        id ? api.getProfile(id) : null,
        id ? api.getFollowing(id) : [],
      ]);
      if (revision !== authRevision.current) return;
      setPosts(feed);
      setPeople(profiles);
      setProfile(ownProfile);
      setFollowing(follows);
    } catch (err) {
      if (revision === authRevision.current) setLoadError(err.message);
    } finally {
      if (revision === authRevision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const apply = (session) => {
      if (!live) return;
      const next = session?.user || null;
      setUser(next);
      if (next) {
        setDemo(false);
        if (authUserRef.current !== next.id) {
          authUserRef.current = next.id;
          setPosts([]);
          setProfile(null);
          setFollowing([]);
          setPeople([]);
          setLoadError("");
          void refresh(next.id);
        }
      } else {
        authUserRef.current = null;
        ++authRevision.current;
        setDemo(true);
        setProfile(null);
        setPosts([]);
        setFollowing([]);
        setLoading(false);
      }
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) notify(error.message);
      else apply(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => apply(session));
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [refresh, notify]);
  useEffect(() => {
    try {
      localStorage.setItem(demoStorageKey, JSON.stringify(demoData));
    } catch {
      queueMicrotask(() =>
        notify(
          "Browser storage is full or unavailable. This demo change lasts until you refresh.",
        ),
      );
    }
  }, [demoData, notify]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const openedLink = useRef(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("post");
    if (
      id &&
      openedLink.current !== id &&
      activePosts.some((p) => p.id === id)
    ) {
      openedLink.current = id;
      queueMicrotask(() => {
        setSelectedPost(id);
        setModal("post");
      });
    }
  }, [activePosts]); // Open shared links after their feed is ready.
  const navigate = (target) => {
    setView(target);
    setQuery("");
    setSelectedProfile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updatePost = (id, update) =>
    !demo && authUserRef.current !== user?.id
      ? undefined
      : demo
        ? setDemoData((d) => ({
            ...d,
            posts: d.posts.map((p) => (p.id === id ? update(p) : p)),
          }))
        : setPosts((ps) => ps.map((p) => (p.id === id ? update(p) : p)));
  const action = async (key, fn) => {
    if (pending.current.has(key)) return;
    pending.current.add(key);
    try {
      await fn();
    } catch (err) {
      notify(err.message);
    } finally {
      pending.current.delete(key);
    }
  };
  const like = (post) =>
    action(`like-${post.id}`, async () => {
      if (!demo) await api.toggleLike(post.id, user.id, post.liked);
      updatePost(post.id, (p) => ({
        ...p,
        liked: !p.liked,
        likes_count: Math.max(0, p.likes_count + (p.liked ? -1 : 1)),
      }));
    });
  const save = (post) =>
    action(`save-${post.id}`, async () => {
      if (!demo) await api.toggleSave(post.id, user.id, post.saved);
      updatePost(post.id, (p) => ({ ...p, saved: !p.saved }));
      notify(
        post.saved
          ? "Removed from your saved moments."
          : "A good moment, kept. Find it in Saved.",
      );
    });
  const comment = async (id, body) => {
    try {
      const c = demo
        ? {
            id: crypto.randomUUID(),
            body,
            profile: me,
            created_at: new Date().toISOString(),
          }
        : await api.addComment(id, user.id, body);
      updatePost(id, (p) => ({ ...p, comments: [...p.comments, c] }));
    } catch (err) {
      notify(err.message);
      throw err;
    }
  };
  const follow = (target) =>
    action(`follow-${target.id}`, async () => {
      const has = activeFollowing.includes(target.id);
      if (!demo) await api.toggleFollow(target.id, user.id, has);
      if (!demo && authUserRef.current !== user?.id) return;
      if (demo)
        setDemoData((d) => ({
          ...d,
          following: has
            ? d.following.filter((id) => id !== target.id)
            : [...d.following, target.id],
        }));
      else
        setFollowing((ids) =>
          has ? ids.filter((id) => id !== target.id) : [...ids, target.id],
        );
      notify(
        has
          ? `Unfollowed ${target.username}`
          : `You're now following ${target.username}`,
      );
    });
  const openProfile = (p) => {
    setSelectedProfile(p);
    setView("Profile");
    setModal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const create = async (file, fields) => {
    if (demo) {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.readAsDataURL(file);
      });
      setDemoData((d) => ({
        ...d,
        posts: [
          {
            id: crypto.randomUUID(),
            user_id: me.id,
            image_url: image,
            ...fields,
            created_at: new Date().toISOString(),
            profile: me,
            likes_count: 0,
            liked: false,
            saved: false,
            comments: [],
          },
          ...d.posts,
        ],
      }));
    } else {
      await api.createPost(user.id, file, fields);
      if (authUserRef.current !== user?.id) return;
      await refresh(user.id);
    }
    closeModal();
    navigate("Home");
    setFeedTab("For you");
    notify(
      demo
        ? "Shared in your demo. Only visible in this browser."
        : "Your moment is live.",
    );
  };
  const edit = async (values) => {
    if (demo)
      setDemoData((d) => {
        const updated = { ...d.me, ...values };
        return {
          ...d,
          me: updated,
          posts: d.posts.map((p) => ({
            ...p,
            profile: p.user_id === updated.id ? updated : p.profile,
            comments: p.comments.map((c) => ({
              ...c,
              profile: c.profile?.id === updated.id ? updated : c.profile,
            })),
          })),
        };
      });
    else {
      const updated = await api.updateProfile(user.id, values);
      if (authUserRef.current !== user?.id) return;
      setProfile(updated);
      await refresh(user.id);
    }
    setSelectedProfile(null);
    closeModal();
    notify("Profile updated.");
  };
  const share = async (post) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("post", post.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      notify(
        demo
          ? "Demo link copied. Custom demo posts stay in this browser."
          : "Post link copied.",
      );
    } catch {
      notify("Clipboard access is unavailable in this browser.");
    }
  };
  const remove = async () => {
    await action(`delete-${pendingDelete.id}`, async () => {
      let result;
      if (!demo) {
        result = await api.deletePost(
          pendingDelete.id,
          user.id,
          pendingDelete.image_url,
        );
        if (authUserRef.current !== user?.id) return;
      }
      if (demo)
        setDemoData((d) => ({
          ...d,
          posts: d.posts.filter((p) => p.id !== pendingDelete.id),
        }));
      else setPosts((ps) => ps.filter((p) => p.id !== pendingDelete.id));
      closeModal();
      notify(result?.warning || "Post deleted.");
    });
  };
  const cardProps = {
    me,
    onLike: like,
    onSave: save,
    onComment: comment,
    onProfile: openProfile,
    onShare: share,
    onDelete: (p) => {
      setPendingDelete(p);
      setModal("delete");
    },
  };
  const searchTerm = query.toLowerCase().trim();
  const filteredPosts = activePosts.filter(
    (p) =>
      (!searchTerm ||
        `${p.caption} ${p.location} ${p.profile?.username}`
          .toLowerCase()
          .includes(searchTerm)) &&
      (view !== "Saved" || p.saved) &&
      (view !== "Home" ||
        feedTab !== "Following" ||
        activeFollowing.includes(p.user_id) ||
        p.user_id === me.id),
  );
  const shownProfile = selectedProfile || me;
  const profilePosts = activePosts.filter((p) => p.user_id === shownProfile.id);
  const selected = activePosts.find((p) => p.id === selectedPost);
  const ownProfile = shownProfile.id === me.id;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("Home");
          }}
        >
          <span className="brand-mark">
            <Camera size={23} strokeWidth={1.8} />
          </span>
          frame<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-label">YOUR DAILY DOSE</div>
        <nav aria-label="Main navigation">
          {[
            [Home, "Home"],
            [Compass, "Explore"],
            [Bookmark, "Saved"],
            [Users, "Profile"],
          ].map(([Icon, label]) => (
            <button
              key={label}
              className={`nav-item ${view === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={21} strokeWidth={view === label ? 2 : 1.7} />
              <span>{label}</span>
              {view === label && <i />}
            </button>
          ))}
        </nav>
        <button
          className="button primary create-button"
          onClick={() => setModal("create")}
        >
          <Plus size={20} /> Create a post
        </button>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sparkles size={18} />
            <p>
              Less scrolling.
              <br />
              <strong>More feeling.</strong>
            </p>
            <span>A little window into your world.</span>
          </div>
          <button
            className="account-button"
            onClick={() => navigate("Profile")}
          >
            <Avatar person={me} />
            <span>
              <strong>{me.username}</strong>
              <small>{demo ? "Demo creator" : "Your personal space"}</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your world <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              placeholder="Search people, places, inspiration…"
              aria-label="Search people, places, inspiration"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (view === "Profile") setView("Explore");
              }}
            />
          </label>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setModal("activity")}
              aria-label="Your activity"
            >
              <Heart size={21} />
            </button>
            <button
              className="topbar-avatar"
              onClick={() => navigate("Profile")}
              aria-label="Open your profile"
            >
              <Avatar person={me} size="small" />
            </button>
          </div>
        </header>
        <div className={`workspace ${view !== "Home" ? "full-workspace" : ""}`}>
          <main className="main-content" id="main-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {view === "Home"
                    ? "THE EVERYDAY, A LITTLE EXTRAORDINARY"
                    : view === "Explore"
                      ? "FOLLOW YOUR CURIOSITY"
                      : view === "Saved"
                        ? "THE ONES YOU WANT TO KEEP"
                        : "A LITTLE WINDOW INTO YOUR WORLD"}
                </div>
                <h1>
                  {view === "Home"
                    ? "A little more life."
                    : view === "Explore"
                      ? "Find your next inspiration."
                      : view === "Saved"
                        ? "Worth coming back to."
                        : "Your corner of the world."}
                </h1>
                <p>
                  {view === "Home"
                    ? "Fresh perspectives from your favorite people."
                    : view === "Explore"
                      ? "New places, new people, and a different point of view."
                      : view === "Saved"
                        ? "A collection of moments that made you stop."
                        : "Every moment tells a little of your story."}
                </p>
              </div>
              {view === "Home" && (
                <span className="heading-flower">
                  <Sparkles size={28} strokeWidth={1.2} />
                </span>
              )}
            </div>
            <div className="demo-banner">
              <span>
                <i className={demo ? "" : "live-dot"} />
                {demo ? "Demo workspace" : "Connected to Supabase"}
                <small>
                  {demo
                    ? "Try it out. Changes stay in this browser."
                    : "Your moments, shared with the community."}
                </small>
              </span>
              {demo ? (
                <button onClick={() => setModal("auth")}>
                  Sign in <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const { error } = await supabase.auth.signOut();
                    if (error) notify(error.message);
                    else {
                      navigate("Home");
                      notify("Signed out.");
                    }
                  }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              )}
            </div>
            {loading && !demo && (
              <div className="loading-state" role="status">
                <LoaderCircle className="spin" /> Bringing your world together…
              </div>
            )}
            {loadError && !demo && (
              <div className="error-state" role="alert">
                <h3>We couldn’t load your feed.</h3>
                <p>{loadError}</p>
                <button
                  className="button secondary"
                  onClick={() => refresh(user?.id)}
                >
                  Try again
                </button>
              </div>
            )}
            {view === "Home" && !query && (
              <section className="stories" aria-label="Creator collections">
                <button
                  className="story your-story"
                  onClick={() => setModal("create")}
                >
                  <span className="story-avatar">
                    <Avatar person={me} size="large" />
                    <i>
                      <Plus size={13} />
                    </i>
                  </span>
                  <span>Your moment</span>
                </button>
                {activePeople.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    className="story"
                    onClick={() => {
                      const first = activePosts.find(
                        (post) => post.user_id === p.id,
                      );
                      if (first) {
                        setSelectedPost(first.id);
                        setModal("post");
                      } else openProfile(p);
                    }}
                  >
                    <Avatar person={p} size="large" ring />
                    <span>{p.username.split(".")[0]}</span>
                  </button>
                ))}
              </section>
            )}
            {query && (
              <section className="search-people">
                <h3>People</h3>
                <div>
                  {activePeople
                    .filter((p) =>
                      `${p.username} ${p.full_name}`
                        .toLowerCase()
                        .includes(searchTerm),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        className="person-button"
                        onClick={() => openProfile(p)}
                      >
                        <Avatar person={p} />
                        <span>
                          <strong>{p.username}</strong>
                          <small>{p.full_name}</small>
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            )}
            {view === "Home" && (
              <div className="feed-tabs">
                <div role="tablist" aria-label="Feed filter">
                  {["For you", "Following"].map((tab) => (
                    <button
                      role="tab"
                      aria-selected={feedTab === tab}
                      className={feedTab === tab ? "selected" : ""}
                      key={tab}
                      onClick={() => setFeedTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span>
                  <span className="tiny-dot" />{" "}
                  {demo ? "A fresh perspective" : "Latest moments"}
                </span>
              </div>
            )}
            {view === "Profile" ? (
              <>
                <section className="profile-header">
                  <Avatar person={shownProfile} size="profile-size" />
                  <div>
                    <div className="profile-title">
                      <h2>{shownProfile.username}</h2>
                      {ownProfile ? (
                        <button
                          className="button secondary"
                          onClick={() => setModal("edit")}
                        >
                          Edit profile
                        </button>
                      ) : (
                        <button
                          className={`button ${activeFollowing.includes(shownProfile.id) ? "secondary" : "primary"}`}
                          onClick={() => follow(shownProfile)}
                        >
                          {activeFollowing.includes(shownProfile.id)
                            ? "Following"
                            : "Follow"}
                        </button>
                      )}
                    </div>
                    <strong>{shownProfile.full_name}</strong>
                    <p>
                      {shownProfile.bio ||
                        "Making memories, one photo at a time."}
                    </p>
                    <div className="profile-stats">
                      <span>
                        <b>{profilePosts.length}</b> posts
                      </span>
                      {ownProfile && (
                        <span>
                          <b>{activeFollowing.length}</b> following
                        </span>
                      )}
                    </div>
                  </div>
                </section>
                <div className="grid-heading">
                  <Grid3X3 size={17} /> Moments
                </div>
                <div className="photo-grid">
                  {profilePosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPost(p.id);
                        setModal("post");
                      }}
                    >
                      <img src={p.image_url} alt={p.caption || "Photo"} />
                      <span>
                        <Heart size={16} /> {p.likes_count}
                      </span>
                    </button>
                  ))}
                </div>
                {!profilePosts.length && (
                  <Empty
                    icon={Camera}
                    title="A blank canvas, for now."
                    description={
                      ownProfile
                        ? "Share your first moment and make this space yours."
                        : "This creator has not shared a moment yet."
                    }
                    action={ownProfile ? () => setModal("create") : null}
                    actionLabel="Share a moment"
                  />
                )}
              </>
            ) : view === "Home" ? (
              <div className="feed">
                {filteredPosts.map((p) => (
                  <PostCard key={p.id} post={p} {...cardProps} />
                ))}
                {!filteredPosts.length && !loading && (
                  <Empty
                    icon={feedTab === "Following" ? Users : Search}
                    title={
                      query
                        ? "Nothing here just yet."
                        : "Your next favorite moment awaits."
                    }
                    description={
                      query
                        ? "Try another person, place, or keyword."
                        : "Follow a creator or share a photo to bring your feed to life."
                    }
                    action={() => navigate("Explore")}
                    actionLabel="Explore moments"
                  />
                )}
                {filteredPosts.length > 0 && (
                  <div className="feed-end">
                    <span>
                      <Check size={21} />
                    </span>
                    <h3>You’re all caught up.</h3>
                    <p>Now go make a moment of your own.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid-heading">
                  <Grid3X3 size={17} />{" "}
                  {view === "Saved"
                    ? `${filteredPosts.length} saved moments`
                    : "A world worth exploring"}
                  <span>
                    {view === "Saved"
                      ? "Only you can see this collection"
                      : "Pause. Look closer."}
                  </span>
                </div>
                <div className="photo-grid explore-grid">
                  {filteredPosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPost(p.id);
                        setModal("post");
                      }}
                    >
                      <img
                        src={p.image_url}
                        alt={p.caption || "Photo"}
                        loading="lazy"
                      />
                      <span>
                        <Heart size={16} /> {p.likes_count}
                        <MessageCircle size={16} /> {p.comments.length}
                      </span>
                    </button>
                  ))}
                </div>
                {!filteredPosts.length && (
                  <Empty
                    icon={Bookmark}
                    title={
                      view === "Saved"
                        ? "Keep a little inspiration."
                        : "Nothing found."
                    }
                    description={
                      view === "Saved"
                        ? "Tap the bookmark on a post to save it here, just for you."
                        : "Try a different search or share the first photo."
                    }
                    action={() => navigate("Home")}
                    actionLabel="Back to your feed"
                  />
                )}
              </>
            )}
          </main>
          {view === "Home" && (
            <aside className="right-rail">
              <div className="date-note">
                <span>MAKE SPACE FOR</span>
                <strong>the good things.</strong>
                <span className="sun-doodle">✳</span>
              </div>
              <section className="suggestions">
                <div className="section-title">
                  <h2>People you might like</h2>
                  <button onClick={() => navigate("Explore")}>
                    Explore <ArrowRight size={13} />
                  </button>
                </div>
                <p className="muted small">A few fresh faces for your feed.</p>
                {activePeople
                  .filter((p) => p.id !== me.id)
                  .slice(0, 5)
                  .map((p, i) => (
                    <div className="suggestion" key={p.id}>
                      <button
                        className="person-button"
                        onClick={() => openProfile(p)}
                      >
                        <Avatar person={p} />
                        <span>
                          <strong>{p.username}</strong>
                          <small>
                            {
                              [
                                "Suggested for you",
                                "A different point of view",
                                "Your daily inspiration",
                                "The scenic route",
                                "Something beautiful",
                              ][i]
                            }
                          </small>
                        </span>
                      </button>
                      <button
                        className={`follow-button ${activeFollowing.includes(p.id) ? "following" : ""}`}
                        onClick={() => follow(p)}
                        aria-label={`${activeFollowing.includes(p.id) ? "Unfollow" : "Follow"} ${p.username}`}
                      >
                        {activeFollowing.includes(p.id) ? (
                          <Check size={16} />
                        ) : (
                          "Follow"
                        )}
                      </button>
                    </div>
                  ))}
              </section>
              <section className="prompt-card">
                <span className="eyebrow">THE LITTLE THINGS CLUB</span>
                <h2>
                  Ordinary days.
                  <br />
                  Extraordinary details.
                </h2>
                <p>
                  The light through your window.
                  <br />
                  Your favorite corner. That first sip.
                  <br />
                  What made you pause today?
                </p>
                <button onClick={() => setModal("create")}>
                  Share a little moment <ArrowRight size={16} />
                </button>
                <span className="prompt-circle" />
                <span className="prompt-circle second" />
              </section>
              <footer className="rail-footer">
                <p>Built for connection, not comparison.</p>
                <button onClick={() => setModal("about")}>About Frame</button>
                <span>·</span>
                <button onClick={() => setModal("privacy")}>
                  Privacy & safety
                </button>
                <p>© {new Date().getFullYear()} Frame. A fresh perspective.</p>
                <div>
                  <span className="tiny-dot" /> MADE FOR THE MOMENTS IN BETWEEN
                </div>
              </footer>
            </aside>
          )}
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          [Home, "Home"],
          [Compass, "Explore"],
          [Plus, "Create"],
          [Bookmark, "Saved"],
          [Users, "Profile"],
        ].map(([Icon, label]) => (
          <button
            key={label}
            className={view === label ? "active" : ""}
            aria-label={label}
            onClick={() =>
              label === "Create" ? setModal("create") : navigate(label)
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              create: "Share a moment",
              auth: "Welcome to Frame",
              edit: "Edit your profile",
              activity: "Your activity",
              about: "A little more about Frame",
              privacy: "Privacy & safety",
              post: "A moment worth a closer look",
              delete: "Delete this moment?",
            }[modal]
          }
          onClose={closeModal}
          wide={modal === "post"}
        >
          {modal === "create" && <CreatePost me={me} onSubmit={create} />}
          {modal === "auth" && (
            <AuthForm
              onComplete={() => {
                closeModal();
                navigate("Home");
                notify("Welcome to your Frame.");
              }}
            />
          )}
          {modal === "edit" && <EditProfile me={me} onSubmit={edit} />}
          {modal === "post" && selected && (
            <>
              <PostCard
                key={selected.id}
                post={selected}
                {...cardProps}
                compact
              />
              <div className="post-pagination">
                <button
                  className="text-button"
                  disabled={activePosts.indexOf(selected) === 0}
                  onClick={() =>
                    setSelectedPost(
                      activePosts[activePosts.indexOf(selected) - 1].id,
                    )
                  }
                >
                  <ArrowLeft size={16} /> Previous
                </button>
                <span>
                  {activePosts.indexOf(selected) + 1} / {activePosts.length}
                </span>
                <button
                  className="text-button"
                  disabled={
                    activePosts.indexOf(selected) === activePosts.length - 1
                  }
                  onClick={() =>
                    setSelectedPost(
                      activePosts[activePosts.indexOf(selected) + 1].id,
                    )
                  }
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {modal === "activity" && (
            <div className="activity-content">
              <p className="muted">
                A little recap of your time here{demo ? ", in this demo" : ""}.
              </p>
              <div className="activity-stats">
                <span>
                  <Heart />
                  <b>{activePosts.filter((p) => p.liked).length}</b> moments
                  liked
                </span>
                <span>
                  <Bookmark />
                  <b>{activePosts.filter((p) => p.saved).length}</b> moments
                  saved
                </span>
                <span>
                  <Users />
                  <b>{activeFollowing.length}</b> creators followed
                </span>
              </div>
              <button
                className="button secondary full"
                onClick={() => {
                  closeModal();
                  navigate("Saved");
                }}
              >
                Revisit saved moments
              </button>
            </div>
          )}
          {modal === "about" && (
            <div className="info-content">
              <Camera size={34} />
              <h3>Connection, not comparison.</h3>
              <p>
                Frame is an independent, Instagram-inspired photo-sharing
                project built with React, Supabase, and Vercel. It is not
                affiliated with Instagram or Meta.
              </p>
              <p>
                Share photos, discover creators, and keep the little things that
                inspire you. Demo photos come from Unsplash; demo people and
                interactions are sample content.
              </p>
            </div>
          )}
          {modal === "privacy" && (
            <div className="info-content">
              <h3>Your moments deserve care.</h3>
              <p>
                In demo mode, your posts, likes, comments, and profile are
                stored only in this browser. Anyone using this browser profile
                can see them. Clearing site data removes demo changes.
              </p>
              <p>
                When signed in, photos, profiles, comments, likes, and follow
                relationships are public. Saved posts are private to your
                account. Images are stored in a public Supabase bucket. Do not
                upload sensitive or private images.
              </p>
              <p>
                You can delete your own posts. This educational MVP does not yet
                include reporting, blocking, private accounts, or account
                deletion. Do not use it as a production social network without
                adding moderation and retention policies.
              </p>
              <p>
                Sample photos load from Unsplash, which receives your browser’s
                image requests.
              </p>
            </div>
          )}
          {modal === "delete" && (
            <div className="info-content">
              <p>
                This will permanently remove your post and its comments. This
                cannot be undone.
              </p>
              <div className="dialog-actions">
                <button className="button secondary" onClick={closeModal}>
                  Keep it
                </button>
                <button className="button danger" onClick={remove}>
                  Delete post
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function Empty({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={29} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={action}>
          {actionLabel} <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
