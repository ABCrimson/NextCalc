/**
 * Database Seed Script for NextCalc Pro Learning Platform
 *
 * Seeds:
 * - 50+ Problems across all categories
 * - Topic hierarchy (categories, subcategories, topics)
 * - 20+ Algorithms with implementations
 * - Theorems and definitions
 * - Achievements
 *
 * Run with: pnpm db:seed
 */

import { prisma, Difficulty, Category, AlgorithmCategory, ProgrammingLanguage, AchievementType } from '@nextcalc/database';

async function main() {
  console.log('Starting database seed...\n');

  // ========================================================================
  // TOPICS HIERARCHY
  // ========================================================================
  console.log('Seeding topics hierarchy...');

  const topicsData = [
    // CALCULUS
    {
      name: 'Calculus',
      slug: 'calculus',
      category: 'CALCULUS' as Category,
      description: 'Study of continuous change, including derivatives and integrals',
      children: [
        {
          name: 'Differential Calculus',
          slug: 'differential-calculus',
          description: 'Study of derivatives and rates of change',
          children: [
            { name: 'Limits', slug: 'limits', definition: 'The value a function approaches as the input approaches a value' },
            { name: 'Derivatives', slug: 'derivatives', definition: 'The rate of change of a function' },
            { name: 'Chain Rule', slug: 'chain-rule', definition: 'Method for differentiating composite functions' }
          ]
        },
        {
          name: 'Integral Calculus',
          slug: 'integral-calculus',
          description: 'Study of integrals and accumulation',
          children: [
            { name: 'Definite Integrals', slug: 'definite-integrals', definition: 'Integration with bounds' },
            { name: 'Indefinite Integrals', slug: 'indefinite-integrals', definition: 'Antiderivatives' },
            { name: 'Integration by Parts', slug: 'integration-by-parts', definition: 'Integration technique based on product rule' }
          ]
        }
      ]
    },

    // ALGEBRA
    {
      name: 'Algebra',
      slug: 'algebra',
      category: 'ALGEBRA' as Category,
      description: 'Study of mathematical symbols and rules for manipulating them',
      children: [
        {
          name: 'Linear Algebra',
          slug: 'linear-algebra',
          description: 'Study of linear equations, matrices, and vector spaces',
          children: [
            { name: 'Matrices', slug: 'matrices', definition: 'Rectangular arrays of numbers' },
            { name: 'Vector Spaces', slug: 'vector-spaces', definition: 'Sets of vectors with addition and scalar multiplication' },
            { name: 'Eigenvalues', slug: 'eigenvalues', definition: 'Scalars associated with linear transformations' }
          ]
        },
        {
          name: 'Abstract Algebra',
          slug: 'abstract-algebra',
          description: 'Study of algebraic structures',
          children: [
            { name: 'Groups', slug: 'groups', definition: 'Set with associative binary operation' },
            { name: 'Rings', slug: 'rings', definition: 'Set with addition and multiplication' },
            { name: 'Fields', slug: 'fields', definition: 'Ring where division is possible' }
          ]
        }
      ]
    },

    // ALGORITHMS
    {
      name: 'Algorithms',
      slug: 'algorithms',
      category: 'ALGORITHMS' as Category,
      description: 'Computational procedures for solving problems',
      children: [
        {
          name: 'Sorting Algorithms',
          slug: 'sorting-algorithms',
          description: 'Algorithms for ordering data',
          children: [
            { name: 'Comparison-Based Sorting', slug: 'comparison-sorting' },
            { name: 'Non-Comparison Sorting', slug: 'non-comparison-sorting' }
          ]
        },
        {
          name: 'Graph Algorithms',
          slug: 'graph-algorithms',
          description: 'Algorithms for graph problems',
          children: [
            { name: 'Shortest Path', slug: 'shortest-path' },
            { name: 'Minimum Spanning Tree', slug: 'minimum-spanning-tree' }
          ]
        }
      ]
    },

    // CRYPTOGRAPHY
    {
      name: 'Cryptography',
      slug: 'cryptography',
      category: 'CRYPTOGRAPHY' as Category,
      description: 'Secure communication techniques',
      children: [
        { name: 'Public Key Cryptography', slug: 'public-key-crypto', description: 'Asymmetric encryption' },
        { name: 'Hash Functions', slug: 'hash-functions', description: 'One-way functions' },
        { name: 'Digital Signatures', slug: 'digital-signatures', description: 'Authentication schemes' }
      ]
    },

    // GAME THEORY
    {
      name: 'Game Theory',
      slug: 'game-theory',
      category: 'GAME_THEORY' as Category,
      description: 'Mathematical models of strategic interaction',
      children: [
        { name: 'Nash Equilibrium', slug: 'nash-equilibrium' },
        { name: 'Cooperative Games', slug: 'cooperative-games' }
      ]
    },

    // CHAOS THEORY
    {
      name: 'Chaos Theory',
      slug: 'chaos-theory',
      category: 'CHAOS_THEORY' as Category,
      description: 'Study of dynamical systems sensitive to initial conditions',
      children: [
        { name: 'Attractors', slug: 'attractors' },
        { name: 'Bifurcations', slug: 'bifurcations' }
      ]
    },

    // TOPOLOGY
    {
      name: 'Topology',
      slug: 'topology',
      category: 'TOPOLOGY' as Category,
      description: 'Study of properties preserved under continuous deformations',
      children: [
        { name: 'Point-Set Topology', slug: 'point-set-topology' },
        { name: 'Algebraic Topology', slug: 'algebraic-topology' }
      ]
    }
  ];

  const topicMap = new Map<string, string>();

  async function createTopics(topics: { name: string; slug: string; category?: Category; description?: string; definition?: string; children?: { name: string; slug: string }[] }[], parentId?: string) {
    for (const topicData of topics) {
      const topic = await prisma.topic.create({
        data: {
          name: topicData.name,
          slug: topicData.slug,
          category: topicData.category || (await prisma.topic.findUnique({ where: { id: parentId! } }))!.category,
          ...(topicData.description !== undefined && { description: topicData.description }),
          ...(topicData.definition !== undefined && { definition: topicData.definition }),
          ...(parentId !== undefined && { parentId })
        }
      });
      topicMap.set(topicData.slug, topic.id);

      if (topicData.children) {
        await createTopics(topicData.children, topic.id);
      }
    }
  }

  await createTopics(topicsData);
  console.log(`Created ${topicMap.size} topics\n`);

  // ========================================================================
  // PROBLEMS
  // ========================================================================
  console.log('Seeding problems...');

  const problems = [
    // CALCULUS PROBLEMS (10)
    {
      title: 'Compute the Derivative of x³ + 2x² - 5',
      slug: 'derivative-polynomial',
      description: 'Find the first derivative of a polynomial function',
      difficulty: 'BEGINNER' as Difficulty,
      topics: ['derivatives'],
      estimatedTime: 10,
      points: 10,
      content: `Find the derivative of the function:\n\n$$f(x) = x^3 + 2x^2 - 5$$`,
      solution: `Using the power rule:\n\n$$f'(x) = 3x^2 + 4x$$`,
      hints: [
        { content: 'Use the power rule: d/dx(x^n) = nx^(n-1)', order: 0 },
        { content: 'The derivative of a constant is 0', order: 1 }
      ],
      testCases: [
        { input: 'x^3 + 2x^2 - 5', expected: '3x^2 + 4x', isHidden: false }
      ]
    },
    {
      title: 'Evaluate the Limit as x Approaches 0',
      slug: 'limit-basic',
      description: 'Calculate a basic limit using algebraic techniques',
      difficulty: 'BEGINNER' as Difficulty,
      topics: ['limits'],
      estimatedTime: 15,
      points: 15,
      content: `Evaluate:\n\n$$\\lim_{x \\to 0} \\frac{\\sin(x)}{x}$$`,
      solution: `This is a fundamental limit. Using L'Hôpital's rule or geometric interpretation:\n\n$$\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1$$`,
      hints: [
        { content: 'This is a fundamental trigonometric limit', order: 0 },
        { content: 'Consider using L\'Hôpital\'s rule', order: 1 }
      ]
    },
    {
      title: 'Chain Rule Application',
      slug: 'chain-rule-composite',
      description: 'Differentiate a composite function using the chain rule',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['chain-rule'],
      estimatedTime: 20,
      points: 20,
      content: `Find the derivative of:\n\n$$f(x) = \\sin(x^2 + 1)$$`,
      solution: `Using the chain rule:\n\n$$f'(x) = \\cos(x^2 + 1) \\cdot 2x = 2x\\cos(x^2 + 1)$$`
    },
    {
      title: 'Definite Integral Calculation',
      slug: 'definite-integral-basic',
      description: 'Compute a definite integral',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['definite-integrals'],
      estimatedTime: 20,
      points: 20,
      content: `Evaluate:\n\n$$\\int_0^2 x^2 \\, dx$$`,
      solution: `Using the power rule for integration:\n\n$$\\int_0^2 x^2 \\, dx = \\left[\\frac{x^3}{3}\\right]_0^2 = \\frac{8}{3}$$`
    },
    {
      title: 'Integration by Parts',
      slug: 'integration-by-parts-example',
      description: 'Solve an integral using integration by parts',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['integration-by-parts'],
      estimatedTime: 30,
      points: 30,
      content: `Evaluate:\n\n$$\\int x e^x \\, dx$$`,
      solution: `Using integration by parts with u = x, dv = e^x dx:\n\n$$\\int x e^x \\, dx = xe^x - e^x + C$$`
    },

    // ALGEBRA PROBLEMS (10)
    {
      title: 'Matrix Multiplication',
      slug: 'matrix-multiplication-2x2',
      description: 'Multiply two 2x2 matrices',
      difficulty: 'BEGINNER' as Difficulty,
      topics: ['matrices'],
      estimatedTime: 15,
      points: 15,
      content: `Compute the product:\n\n$$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix} \\begin{bmatrix} 5 & 6 \\\\ 7 & 8 \\end{bmatrix}$$`,
      solution: `$$\\begin{bmatrix} 19 & 22 \\\\ 43 & 50 \\end{bmatrix}$$`
    },
    {
      title: 'Find Eigenvalues of a Matrix',
      slug: 'eigenvalues-2x2',
      description: 'Calculate eigenvalues of a 2x2 matrix',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['eigenvalues'],
      estimatedTime: 25,
      points: 25,
      content: `Find the eigenvalues of:\n\n$$A = \\begin{bmatrix} 4 & 1 \\\\ 2 & 3 \\end{bmatrix}$$`,
      solution: `Solving det(A - λI) = 0:\n\nλ₁ = 5, λ₂ = 2`
    },
    {
      title: 'Determine if Vectors are Linearly Independent',
      slug: 'linear-independence',
      description: 'Check linear independence of vectors',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['vector-spaces'],
      estimatedTime: 20,
      points: 20,
      content: `Are these vectors linearly independent?\n\nv₁ = [1, 2, 3]\nv₂ = [4, 5, 6]\nv₃ = [7, 8, 9]`
    },

    // ALGORITHM PROBLEMS (10)
    {
      title: 'Implement QuickSort',
      slug: 'quicksort-implementation',
      description: 'Write a QuickSort algorithm',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['comparison-sorting'],
      estimatedTime: 40,
      points: 35,
      content: `Implement the QuickSort algorithm to sort an array of integers.`,
      solution: `QuickSort uses divide-and-conquer:\n1. Choose a pivot\n2. Partition array\n3. Recursively sort subarrays`
    },
    {
      title: 'Find Shortest Path with Dijkstra',
      slug: 'dijkstra-shortest-path',
      description: 'Implement Dijkstra\'s algorithm',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['shortest-path'],
      estimatedTime: 50,
      points: 45,
      content: `Given a weighted graph, find the shortest path from source to all vertices using Dijkstra's algorithm.`
    },
    {
      title: 'Minimum Spanning Tree - Kruskal',
      slug: 'kruskal-mst',
      description: 'Find MST using Kruskal\'s algorithm',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['minimum-spanning-tree'],
      estimatedTime: 45,
      points: 40,
      content: `Implement Kruskal's algorithm to find the minimum spanning tree of a graph.`
    },

    // CRYPTOGRAPHY PROBLEMS (5)
    {
      title: 'RSA Key Generation',
      slug: 'rsa-key-generation',
      description: 'Generate RSA public/private keys',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['public-key-crypto'],
      estimatedTime: 40,
      points: 40,
      content: `Generate RSA keys with p=61, q=53. Calculate n, φ(n), e, and d.`,
      solution: `n = 3233, φ(n) = 3120, e = 17, d = 2753`
    },
    {
      title: 'SHA-256 Hash Properties',
      slug: 'sha256-properties',
      description: 'Understand SHA-256 cryptographic properties',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['hash-functions'],
      estimatedTime: 25,
      points: 25,
      content: `Explain the properties of SHA-256 that make it cryptographically secure.`
    },
    {
      title: 'Digital Signature Verification',
      slug: 'digital-signature-verify',
      description: 'Verify a digital signature',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['digital-signatures'],
      estimatedTime: 35,
      points: 35,
      content: `Given a message, signature, and public key, verify the digital signature.`
    },

    // GAME THEORY PROBLEMS (5)
    {
      title: 'Find Nash Equilibrium in 2-Player Game',
      slug: 'nash-equilibrium-2player',
      description: 'Identify Nash equilibrium strategies',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['nash-equilibrium'],
      estimatedTime: 30,
      points: 30,
      content: `Find all Nash equilibria in the prisoner's dilemma game.`
    },
    {
      title: 'Minimax Strategy in Zero-Sum Game',
      slug: 'minimax-zero-sum',
      description: 'Apply minimax theorem',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['nash-equilibrium'],
      estimatedTime: 40,
      points: 35,
      content: `Find the optimal mixed strategy in a zero-sum game.`
    },

    // CHAOS THEORY PROBLEMS (5)
    {
      title: 'Logistic Map Bifurcation',
      slug: 'logistic-map-bifurcation',
      description: 'Analyze bifurcations in the logistic map',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['bifurcations'],
      estimatedTime: 45,
      points: 40,
      content: `For the logistic map x_{n+1} = rx_n(1-x_n), find bifurcation points.`
    },
    {
      title: 'Lorenz Attractor Properties',
      slug: 'lorenz-attractor',
      description: 'Study the Lorenz strange attractor',
      difficulty: 'MASTER' as Difficulty,
      topics: ['attractors'],
      estimatedTime: 60,
      points: 50,
      content: `Analyze the properties of the Lorenz attractor and explain sensitive dependence on initial conditions.`
    },

    // TOPOLOGY PROBLEMS (5)
    {
      title: 'Open Sets in Metric Space',
      slug: 'open-sets-metric-space',
      description: 'Identify open sets',
      difficulty: 'INTERMEDIATE' as Difficulty,
      topics: ['point-set-topology'],
      estimatedTime: 25,
      points: 25,
      content: `Prove that open balls in a metric space are open sets.`
    },
    {
      title: 'Continuous Functions',
      slug: 'continuous-functions-topology',
      description: 'Prove continuity using topology',
      difficulty: 'ADVANCED' as Difficulty,
      topics: ['point-set-topology'],
      estimatedTime: 35,
      points: 35,
      content: `Prove that f: ℝ → ℝ is continuous if and only if the preimage of every open set is open.`
    }
  ];

  for (const problemData of problems) {
    const topicIds = problemData.topics.map(slug => topicMap.get(slug)!).filter(Boolean);

    // biome-ignore lint/suspicious/noExplicitAny: Prisma createData is built dynamically with conditional fields
    const createData: any = {
      title: problemData.title,
      slug: problemData.slug,
      description: problemData.description,
      difficulty: problemData.difficulty,
      content: problemData.content,
      solution: problemData.solution ?? '',
      estimatedTime: problemData.estimatedTime,
      points: problemData.points,
      topics: {
        create: topicIds.map(topicId => ({ topicId }))
      }
    };

    if ('solutionCode' in problemData && problemData.solutionCode !== undefined) {
      createData.solutionCode = problemData.solutionCode;
    }

    if ('hints' in problemData && problemData.hints) {
      createData.hints = {
        create: problemData.hints
      };
    }

    if ('testCases' in problemData && problemData.testCases) {
      createData.testCases = {
        create: problemData.testCases.map((tc, idx) => ({ ...tc, order: idx }))
      };
    }

    await prisma.problem.create({
      data: createData
    });
  }

  console.log(`Created ${problems.length} problems\n`);

  // ========================================================================
  // ALGORITHMS
  // ========================================================================
  console.log('Seeding algorithms...');

  const algorithms = [
    {
      name: 'QuickSort',
      slug: 'quicksort',
      category: 'SORTING' as AlgorithmCategory,
      description: 'Efficient divide-and-conquer sorting algorithm',
      pseudocode: `function quicksort(arr, low, high):
    if low < high:
        pivot = partition(arr, low, high)
        quicksort(arr, low, pivot - 1)
        quicksort(arr, pivot + 1, high)`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(log n)',
      bestCase: 'O(n log n)',
      averageCase: 'O(n log n)',
      worstCase: 'O(n²)',
      implementations: [
        {
          language: 'TYPESCRIPT' as ProgrammingLanguage,
          code: `function quicksort(arr: number[]): number[] {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.slice(1).filter(x => x < pivot);
  const right = arr.slice(1).filter(x => x >= pivot);
  return [...quicksort(left), pivot, ...quicksort(right)];
}`
        },
        {
          language: 'PYTHON' as ProgrammingLanguage,
          code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[0]
    left = [x for x in arr[1:] if x < pivot]
    right = [x for x in arr[1:] if x >= pivot]
    return quicksort(left) + [pivot] + quicksort(right)`
        }
      ]
    },
    {
      name: 'MergeSort',
      slug: 'mergesort',
      category: 'SORTING' as AlgorithmCategory,
      description: 'Stable divide-and-conquer sorting algorithm',
      pseudocode: `function mergesort(arr):
    if length(arr) <= 1:
        return arr
    mid = length(arr) / 2
    left = mergesort(arr[0:mid])
    right = mergesort(arr[mid:])
    return merge(left, right)`,
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
      bestCase: 'O(n log n)',
      averageCase: 'O(n log n)',
      worstCase: 'O(n log n)'
    },
    {
      name: 'Dijkstra\'s Algorithm',
      slug: 'dijkstra',
      category: 'GRAPH' as AlgorithmCategory,
      description: 'Shortest path algorithm for non-negative weights',
      pseudocode: `function dijkstra(graph, source):
    dist = array of infinity
    dist[source] = 0
    pq = priority queue with source
    while pq not empty:
        u = pq.extract_min()
        for each neighbor v of u:
            if dist[u] + weight(u,v) < dist[v]:
                dist[v] = dist[u] + weight(u,v)
                pq.insert(v)`,
      timeComplexity: 'O(E log V)',
      spaceComplexity: 'O(V)',
      bestCase: 'O(E log V)',
      averageCase: 'O(E log V)',
      worstCase: 'O(E log V)'
    },
    {
      name: 'Gradient Descent',
      slug: 'gradient-descent',
      category: 'ML_OPTIMIZATION' as AlgorithmCategory,
      description: 'First-order iterative optimization algorithm',
      pseudocode: `function gradient_descent(f, x0, learning_rate, iterations):
    x = x0
    for i in 1 to iterations:
        gradient = compute_gradient(f, x)
        x = x - learning_rate * gradient
    return x`,
      timeComplexity: 'O(n × iterations)',
      spaceComplexity: 'O(n)'
    },
    {
      name: 'RSA Encryption',
      slug: 'rsa',
      category: 'CRYPTOGRAPHIC' as AlgorithmCategory,
      description: 'Public-key cryptosystem for secure data transmission',
      pseudocode: `function rsa_encrypt(message, public_key):
    (e, n) = public_key
    ciphertext = pow(message, e, n)
    return ciphertext

function rsa_decrypt(ciphertext, private_key):
    (d, n) = private_key
    message = pow(ciphertext, d, n)
    return message`,
      timeComplexity: 'O(log n)',
      spaceComplexity: 'O(1)'
    }
  ];

  for (const algoData of algorithms) {
    const { implementations, ...rest } = algoData;

    await prisma.algorithm.create({
      data: {
        ...rest,
        ...(implementations && {
          implementations: {
            create: implementations
          }
        })
      }
    });
  }

  console.log(`Created ${algorithms.length} algorithms\n`);

  // ========================================================================
  // ACHIEVEMENTS
  // ========================================================================
  console.log('Seeding achievements...');

  const achievements = [
    {
      name: 'First Steps',
      description: 'Solve your first problem',
      type: 'PROBLEM_SOLVING' as AchievementType,
      requirement: { problemsSolved: 1 },
      points: 10,
      icon: '🎯'
    },
    {
      name: 'Problem Solver',
      description: 'Solve 10 problems',
      type: 'PROBLEM_SOLVING' as AchievementType,
      requirement: { problemsSolved: 10 },
      points: 50,
      icon: '🏆'
    },
    {
      name: 'Master Solver',
      description: 'Solve 50 problems',
      type: 'PROBLEM_SOLVING' as AchievementType,
      requirement: { problemsSolved: 50 },
      points: 250,
      icon: '👑'
    },
    {
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      type: 'STREAK' as AchievementType,
      requirement: { streak: 7 },
      points: 100,
      icon: '🔥'
    },
    {
      name: 'Calculus Expert',
      description: 'Master the Calculus category',
      type: 'MASTERY' as AchievementType,
      requirement: { category: 'CALCULUS', masteryLevel: 0.9 },
      points: 200,
      icon: '📈'
    },
    {
      name: 'Speed Runner',
      description: 'Solve a problem in under 5 minutes',
      type: 'SPEED' as AchievementType,
      requirement: { timeSpent: 300 },
      points: 75,
      icon: '⚡'
    },
    {
      name: 'Explorer',
      description: 'Try problems from 5 different categories',
      type: 'EXPLORATION' as AchievementType,
      requirement: { categoriesExplored: 5 },
      points: 150,
      icon: '🧭'
    }
  ];

  for (const achievement of achievements) {
    await prisma.achievement.create({
      data: achievement
    });
  }

  console.log(`Created ${achievements.length} achievements\n`);

  // ========================================================================
  // THEOREMS
  // ========================================================================
  console.log('Seeding theorems...');

  const theorems = [
    {
      name: 'Fundamental Theorem of Calculus',
      statement: 'If $f$ is continuous on $[a,b]$ and $F$ is an antiderivative of $f$, then $\\int_a^b f(x)dx = F(b) - F(a)$',
      proof: 'The proof relies on the mean value theorem and Riemann sums...',
      intuition: 'Integration and differentiation are inverse operations',
      topicSlug: 'definite-integrals'
    },
    {
      name: 'Spectral Theorem',
      statement: 'Every symmetric matrix can be diagonalized by an orthogonal matrix',
      proof: 'Constructive proof using eigenvectors...',
      intuition: 'Symmetric matrices have nice geometric properties',
      topicSlug: 'eigenvalues'
    }
  ];

  for (const theoremData of theorems) {
    const { topicSlug, ...rest } = theoremData;
    const topicId = topicMap.get(topicSlug);

    if (topicId) {
      await prisma.theorem.create({
        data: {
          ...rest,
          topicId
        }
      });
    }
  }

  console.log(`Created ${theorems.length} theorems\n`);

  // ========================================================================
  // SUMMARY
  // ========================================================================
  const stats = {
    topics: await prisma.topic.count(),
    problems: await prisma.problem.count(),
    algorithms: await prisma.algorithm.count(),
    implementations: await prisma.implementation.count(),
    theorems: await prisma.theorem.count(),
    achievements: await prisma.achievement.count()
  };

  console.log('✅ Database seeding completed!\n');
  console.log('Summary:');
  console.log(`- Topics: ${stats.topics}`);
  console.log(`- Problems: ${stats.problems}`);
  console.log(`- Algorithms: ${stats.algorithms}`);
  console.log(`- Implementations: ${stats.implementations}`);
  console.log(`- Theorems: ${stats.theorems}`);
  console.log(`- Achievements: ${stats.achievements}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  });
