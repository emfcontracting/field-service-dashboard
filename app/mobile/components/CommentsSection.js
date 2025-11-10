// mobile/components/CommentsSection.js
'use client';

import { useState, useEffect } from 'react';
import { loadComments, addComment } from '../utils/workOrderHelpers';
import { formatDateTime } from '../utils/formatters';

export default function CommentsSection({ workOrder, currentUser, supabase, saving, setSaving }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    if (workOrder?.wo_id) {
      fetchComments();
    }
  }, [workOrder?.wo_id]);

  const fetchComments = async () => {
    const result = await loadComments(supabase, workOrder.wo_id);
    if (result.success) {
      setComments(result.data);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    setSaving(true);
    const result = await addComment(supabase, workOrder.wo_id, currentUser.user_id, newComment);
    
    if (result.success) {
      await fetchComments();
      setNewComment('');
    } else {
      alert('Error adding comment: ' + result.error);
    }
    setSaving(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">💬 Comments ({comments.length})</h3>
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-sm text-blue-400"
        >
          {showComments ? 'Hide' : 'Show'}
        </button>
      </div>

      {showComments && (
        <>
          {/* Comments List */}
          <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.comment_id} className="bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm">
                      {comment.user?.first_name} {comment.user?.last_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{comment.comment}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <div className="space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white"
              rows="3"
              disabled={saving}
            />
            <button
              onClick={handleAddComment}
              disabled={saving || !newComment.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
            >
              {saving ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}