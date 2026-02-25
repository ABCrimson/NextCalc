/**
 * Profile Dashboard Resolvers
 *
 * Queries for user profile data, activity heatmaps, and learning analytics.
 */

import type { GraphQLContext } from '../../lib/context';
import { requireAuth } from '../../lib/context';

export const profileResolvers = {
	Query: {
		userProfile: async (
			_parent: unknown,
			args: { userId: string },
			context: GraphQLContext,
		) => {
			requireAuth(context);

			const dbUser = await context.prisma.user.findUnique({
				where: { id: args.userId },
			});
			if (!dbUser) return null;

			const userProgress = await context.prisma.userProgress.findUnique({
				where: { userId: args.userId },
			});

			const recentAchievements = userProgress
				? await context.prisma.userAchievement.findMany({
						where: { userProgressId: userProgress.id },
						include: { achievement: true },
						orderBy: { earnedAt: 'desc' },
						take: 10,
					})
				: [];

			const [worksheetCount, forumPostCount, calculationCount] =
				await Promise.all([
					context.prisma.worksheet.count({
						where: { userId: args.userId, deletedAt: null },
					}),
					context.prisma.forumPost.count({
						where: { authorId: args.userId, deletedAt: null },
					}),
					context.prisma.calculationHistory.count({
						where: { userId: args.userId },
					}),
				]);

			return {
				user: dbUser,
				progress: userProgress,
				recentAchievements: recentAchievements.map((ua) => ({
					id: ua.achievement.id,
					name: ua.achievement.name,
					description: ua.achievement.description,
					type: ua.achievement.type,
					icon: ua.achievement.icon,
					points: ua.achievement.points,
					badgeUrl: ua.achievement.badgeUrl,
					earnedAt: ua.earnedAt,
				})),
				worksheetCount,
				forumPostCount,
				calculationCount,
			};
		},

		userActivity: async (
			_parent: unknown,
			args: { userId: string; days: number },
			context: GraphQLContext,
		) => {
			requireAuth(context);
			const since = new Date();
			since.setDate(since.getDate() - args.days);

			const attempts = await context.prisma.attempt.findMany({
				where: {
					userProgress: { userId: args.userId },
					createdAt: { gte: since },
				},
				select: { createdAt: true },
			});

			const calculations = await context.prisma.calculationHistory.findMany({
				where: {
					userId: args.userId,
					createdAt: { gte: since },
				},
				select: { createdAt: true },
			});

			const counts = new Map<string, number>();
			for (const a of attempts) {
				const key = a.createdAt.toISOString().slice(0, 10);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
			for (const c of calculations) {
				const key = c.createdAt.toISOString().slice(0, 10);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}

			return Array.from(counts.entries())
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date));
		},

		userAnalytics: async (
			_parent: unknown,
			args: { userId: string },
			context: GraphQLContext,
		) => {
			requireAuth(context);

			const userProgress = await context.prisma.userProgress.findUnique({
				where: { userId: args.userId },
			});

			if (!userProgress) {
				return {
					topicMastery: [],
					accuracyTrend: [],
					practiceHistory: [],
					streakHistory: [],
				};
			}

			const topicProgressData = await context.prisma.topicProgress.findMany({
				where: { userProgressId: userProgress.id },
				include: { topic: true },
			});

			const topicMastery = topicProgressData.map((tp) => ({
				topic: tp.topic.name,
				mastery: tp.masteryLevel,
				problemsSolved: tp.problemsSolved,
			}));

			const sessions = await context.prisma.practiceSession.findMany({
				where: {
					userProgressId: userProgress.id,
					completedAt: { not: null },
				},
				orderBy: { completedAt: 'desc' },
				take: 30,
			});

			const accuracyTrend = sessions
				.filter((s) => s.completedAt)
				.map((s) => ({
					date: s.completedAt!.toISOString().slice(0, 10),
					accuracy: s.accuracy,
				}))
				.reverse();

			const practiceHistory = sessions.map((s) => ({
				id: s.id,
				topic: s.topic,
				score: s.score,
				accuracy: s.accuracy,
				totalTime: s.totalTime,
				completedAt: s.completedAt?.toISOString() ?? null,
			}));

			const allAttempts = await context.prisma.attempt.findMany({
				where: { userProgressId: userProgress.id, correct: true },
				orderBy: { createdAt: 'asc' },
				select: { createdAt: true },
			});

			const streakByDay = new Map<string, number>();
			let currentStreak = 0;
			let lastDate = '';
			for (const a of allAttempts) {
				const d = a.createdAt.toISOString().slice(0, 10);
				if (d === lastDate) {
					// Same day, streak unchanged
				} else if (lastDate) {
					const prev = new Date(lastDate);
					prev.setDate(prev.getDate() + 1);
					if (prev.toISOString().slice(0, 10) === d) {
						currentStreak++;
					} else {
						currentStreak = 1;
					}
				} else {
					currentStreak = 1;
				}
				lastDate = d;
				streakByDay.set(d, currentStreak);
			}

			const streakHistory = Array.from(streakByDay.entries())
				.map(([date, streak]) => ({ date, streak }))
				.slice(-90);

			return { topicMastery, accuracyTrend, practiceHistory, streakHistory };
		},
	},
};
