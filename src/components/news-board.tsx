import { ActionSheet } from '@/components/action-sheet';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Post = {
  id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

type Member = {
  id: string;
  display_name: string | null;
};

const PREVIEW_COUNT = 3;

// "vor 5 Min.", "gestern", "12. Okt." ...
function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

export function NewsBoard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('news_posts')
      .select('id, author_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) console.error(error);
    else setPosts(data ?? []);
  }, []);

  useEffect(() => {
    loadPosts();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setMembers(data ?? []);
      });

    const channel = supabase
      .channel('news-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_posts' }, () => loadPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  function authorName(id: string | null) {
    if (id === userId) return 'Du';
    return members.find((m) => m.id === id)?.display_name ?? 'Ehemalig';
  }

  async function sendPost() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    const { error } = await supabase.from('news_posts').insert({ content: trimmed });
    setSending(false);

    if (error) {
      Alert.alert('Das hat nicht geklappt', error.message);
      return;
    }
    setText('');
    loadPosts();
  }

  async function deletePost(post: Post) {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const { error } = await supabase.from('news_posts').delete().eq('id', post.id);
    if (error) {
      loadPosts();
      Alert.alert('Das hat nicht geklappt', error.message);
    }
  }

  const visiblePosts = showAll ? posts : posts.slice(0, PREVIEW_COUNT);

  return (
    <View>
      <Text style={styles.sectionTitle}>📌 Pinnwand</Text>

      <View style={styles.card}>
        {/* Neuer Beitrag */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Was gibt's Neues?"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendPost}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </Pressable>
        </View>

        {/* Beiträge */}
        {posts.length === 0 ? (
          <Text style={styles.empty}>Noch nichts los. Schreib den ersten Beitrag!</Text>
        ) : (
          visiblePosts.map((post) => (
            <Pressable
              key={post.id}
              style={styles.post}
              onLongPress={() => post.author_id === userId && setSelectedPost(post)}
            >
              <View style={styles.postHeader}>
                <Text style={styles.postAuthor}>{authorName(post.author_id)}</Text>
                <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
            </Pressable>
          ))
        )}

        {posts.length > PREVIEW_COUNT && (
          <Pressable style={styles.moreButton} onPress={() => setShowAll(!showAll)}>
            <Text style={styles.moreText}>
              {showAll ? 'Weniger anzeigen' : `Alle ${posts.length} anzeigen`}
            </Text>
          </Pressable>
        )}
      </View>

      <ActionSheet
        visible={selectedPost !== null}
        title="Dein Beitrag"
        subtitle={selectedPost?.content}
        actions={
          selectedPost
            ? [{ label: 'Löschen', emoji: '🗑️', destructive: true, onPress: () => deletePost(selectedPost) }]
            : []
        }
        onClose={() => setSelectedPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#5C4033', marginBottom: 12, marginTop: 32 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  input: {
    flex: 1, backgroundColor: '#FFF8F0', borderRadius: 12, paddingHorizontal: 14,
    paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120, marginRight: 8,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#E07A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: 'white', fontSize: 20, fontWeight: '700' },
  post: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F2E6DA' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  postAuthor: { fontSize: 14, fontWeight: '700', color: '#5C4033' },
  postTime: { fontSize: 13, color: '#B5A397' },
  postContent: { fontSize: 15, color: '#5C4033', lineHeight: 21 },
  empty: { textAlign: 'center', color: '#8B6F5E', fontSize: 15, paddingVertical: 12 },
  moreButton: { paddingTop: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F2E6DA' },
  moreText: { color: '#E07A5F', fontSize: 15, fontWeight: '600' },
});