export function relatedComments(index, person, question = "", limit = 5) {
  const topics = index.peopleTopics[person] || [];
  const words = question.toLowerCase().match(/[a-z]{4,}/g) || [];
  return index.comments
    .map((comment) => ({
      comment,
      score:
        comment.topics.filter((t) => topics.includes(t)).length * 3 +
        words.filter((w) => comment.text.toLowerCase().includes(w)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.comment.row - b.comment.row)
    .slice(0, limit)
    .map((x) => x.comment);
}
