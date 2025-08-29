// MockResponseGenerator.js
// This file contains the mock response generation logic for the wizard interface

/**
 * Generates a mock response for the Stack implementation based on user inputs
 *
 * @param {Array} rankedCriteria - The ordered criteria for ranking implementations
 * @param {Number} numVersions - The number of versions to generate
 * @param {String} lql - The LQL interface definition
 * @param {String} userPrompt - The user's description of the implementation
 * @param {Array} selectedLLMs - The selected LLMs to generate implementations
 * @returns {Object} The generated mock response with implementations
 */
export const generateMockResponse = (rankedCriteria, numVersions, lql, userPrompt, selectedLLMs) => {
    // Create and log the JSON payload that would be sent to a backend
    const sessionId = crypto.randomUUID();
    const payload = {
        sessionId,
        lqlInterface: lql,
        userPrompt,
        rankingCriteria: rankedCriteria,
        generationOptions: {
            numberOfVersions: numVersions,
            selectedLLMs
        }
    };

    // Log the payload to the console for debugging purposes
    console.log('API Payload:', payload);

    // Generate mock implementations based on selectedLLMs and numVersions
    const implementations = [];
    const llmOptions = selectedLLMs.length ? selectedLLMs : ['GPT-4o'];

    // Sample code snippets for different implementations
    const codeVariants = [
        {
            className: 'ConcurrentStack',
            imports: [
                'import java.util.concurrent.ConcurrentLinkedDeque;',
                'import java.util.concurrent.atomic.AtomicInteger;'
            ],
            methods: {
                fieldDeclarations: 'private final ConcurrentLinkedDeque<Object> deque = new ConcurrentLinkedDeque<>();\nprivate final AtomicInteger size = new AtomicInteger(0);',
                push: 'public Object push(Object item) {\n    if (item == null) {\n        throw new NullPointerException("Cannot push null item");\n    }\n    deque.push(item);\n    size.incrementAndGet();\n    return item;\n}',
                pop: 'public Object pop() {\n    Object item = deque.poll();\n    if (item != null) {\n        size.decrementAndGet();\n    }\n    return item;\n}',
                peek: 'public Object peek() {\n    return deque.peek();\n}',
                size: 'public int size() {\n    return size.get();\n}'
            },
            testCode: '// Basic test case\n@Test\npublic void testPushAndPop() {\n    ConcurrentStack stack = new ConcurrentStack();\n    stack.push("test");\n    assertEquals(1, stack.size());\n    assertEquals("test", stack.pop());\n    assertNull(stack.pop());\n}',
            llm: llmOptions[0],
            criteriaScores: {
                Efficiency: 9,
                Readability: 7,
                Security: 8,
                Maintainability: 8
            }
        },
        {
            className: 'ThreadSafeStack',
            imports: [
                'import java.util.concurrent.ConcurrentLinkedDeque;',
                'import java.util.NoSuchElementException;'
            ],
            methods: {
                fieldDeclarations: 'private final ConcurrentLinkedDeque<Object> elements = new ConcurrentLinkedDeque<>();',
                push: 'public Object push(Object obj) {\n    if (obj == null) {\n        throw new IllegalArgumentException("Cannot push null onto stack");\n    }\n    elements.addFirst(obj);\n    return obj;\n}',
                pop: 'public Object pop() {\n    try {\n        return elements.removeFirst();\n    } catch (NoSuchElementException e) {\n        return null;\n    }\n}',
                peek: 'public Object peek() {\n    return elements.peekFirst();\n}',
                size: 'public int size() {\n    return elements.size();\n}'
            },
            testCode: '// Testing edge cases\n@Test\npublic void testEmptyStack() {\n    ThreadSafeStack stack = new ThreadSafeStack();\n    assertNull(stack.peek());\n    assertNull(stack.pop());\n    assertEquals(0, stack.size());\n}',
            llm: llmOptions.length > 1 ? llmOptions[1] : llmOptions[0],
            criteriaScores: {
                Efficiency: 8,
                Readability: 9,
                Security: 7,
                Maintainability: 9
            }
        },
        {
            className: 'ConcurrentDequeStack',
            imports: [
                'import java.util.concurrent.ConcurrentLinkedDeque;',
                'import java.util.NoSuchElementException;',
                'import java.util.Objects;'
            ],
            methods: {
                fieldDeclarations: 'private final ConcurrentLinkedDeque<Object> deque = new ConcurrentLinkedDeque<>();',
                push: 'public Object push(Object item) {\n    Objects.requireNonNull(item, "Item cannot be null");\n    deque.addFirst(item);\n    return item;\n}',
                pop: 'public Object pop() {\n    return deque.pollFirst();\n}',
                peek: 'public Object peek() {\n    return deque.peekFirst();\n}',
                size: 'public int size() {\n    return deque.size();\n}'
            },
            testCode: '// Concurrency test\n@Test\npublic void testConcurrentAccess() throws Exception {\n    ConcurrentDequeStack stack = new ConcurrentDequeStack();\n    CountDownLatch latch = new CountDownLatch(1);\n    int numThreads = 10;\n    \n    ExecutorService executor = Executors.newFixedThreadPool(numThreads);\n    for (int i = 0; i < numThreads; i++) {\n        final int id = i;\n        executor.submit(() -> {\n            try {\n                latch.await();\n                stack.push("Item-" + id);\n            } catch (InterruptedException e) {\n                Thread.currentThread().interrupt();\n            }\n        });\n    }\n    \n    latch.countDown();\n    executor.shutdown();\n    executor.awaitTermination(5, TimeUnit.SECONDS);\n    \n    assertEquals(numThreads, stack.size());\n}',
            llm: llmOptions.length > 2 ? llmOptions[2] : llmOptions[0],
            criteriaScores: {
                Efficiency: 9,
                Readability: 8,
                Security: 9,
                Maintainability: 7
            }
        },
        {
            className: 'SimpleThreadSafeStack',
            imports: [
                'import java.util.concurrent.ConcurrentLinkedDeque;'
            ],
            methods: {
                fieldDeclarations: 'private final ConcurrentLinkedDeque<Object> stack = new ConcurrentLinkedDeque<>();',
                push: 'public Object push(Object element) {\n    if (element == null) {\n        throw new IllegalArgumentException("Null elements are not allowed");\n    }\n    stack.push(element);\n    return element;\n}',
                pop: 'public Object pop() {\n    return stack.pollFirst();\n}',
                peek: 'public Object peek() {\n    return stack.peekFirst();\n}',
                size: 'public int size() {\n    return stack.size();\n}'
            },
            testCode: '// Test with various object types\n@Test\npublic void testDifferentObjectTypes() {\n    SimpleThreadSafeStack stack = new SimpleThreadSafeStack();\n    \n    // Push different types of objects\n    stack.push(Integer.valueOf(1));\n    stack.push("String value");\n    stack.push(new ArrayList<String>());\n    \n    assertEquals(3, stack.size());\n    assertTrue(stack.peek() instanceof ArrayList);\n}',
            llm: llmOptions.length > 3 ? llmOptions[3] : llmOptions[0],
            criteriaScores: {
                Efficiency: 7,
                Readability: 9,
                Security: 7,
                Maintainability: 8
            }
        },
        {
            className: 'OptimizedConcurrentStack',
            imports: [
                'import java.util.concurrent.ConcurrentLinkedDeque;',
                'import java.util.Objects;'
            ],
            methods: {
                fieldDeclarations: 'private final ConcurrentLinkedDeque<Object> data = new ConcurrentLinkedDeque<>();',
                push: 'public Object push(Object element) {\n    Objects.requireNonNull(element, "Cannot push null elements");\n    data.offerFirst(element); // offerFirst is slightly more efficient than push\n    return element;\n}',
                pop: 'public Object pop() {\n    return data.pollFirst(); // returns null if empty\n}',
                peek: 'public Object peek() {\n    return data.peekFirst(); // returns null if empty\n}',
                size: 'public int size() {\n    return data.size();\n}'
            },
            testCode: '// Performance test\n@Test\npublic void testPerformance() {\n    OptimizedConcurrentStack stack = new OptimizedConcurrentStack();\n    long start = System.nanoTime();\n    \n    for (int i = 0; i < 100_000; i++) {\n        stack.push(i);\n    }\n    \n    for (int i = 0; i < 100_000; i++) {\n        stack.pop();\n    }\n    \n    long duration = System.nanoTime() - start;\n    System.out.println("Stack operations took: " + duration / 1_000_000 + "ms");\n    assertEquals(0, stack.size());\n}',
            llm: llmOptions.length > 1 ? llmOptions[1] : llmOptions[0],
            criteriaScores: {
                Efficiency: 10,
                Readability: 8,
                Security: 9,
                Maintainability: 7
            }
        }
    ];

    // Select the appropriate number of implementations based on numVersions
    for (let i = 0; i < Math.min(numVersions, codeVariants.length); i++) {
        // Prepare the full implementation
        implementations.push({
            rank: i + 1,
            className: codeVariants[i].className,
            imports: codeVariants[i].imports,
            methods: codeVariants[i].methods,
            code: `public class ${codeVariants[i].className} implements Stack {
    ${codeVariants[i].methods.fieldDeclarations}
    
    ${codeVariants[i].methods.push}
    
    ${codeVariants[i].methods.pop}
    
    ${codeVariants[i].methods.peek}
    
    ${codeVariants[i].methods.size}
}`,
            junitTests: `
import org.junit.Test;
import static org.junit.Assert.*;

public class ${codeVariants[i].className}Test {
    ${codeVariants[i].testCode}
}`,
            testResults: {
                passed: 18 + i,
                total: 20,
                failures: i > numVersions/2 ? [`fail${i}`] : []
            },
            criteriaScores: codeVariants[i].criteriaScores,
            generatedBy: codeVariants[i].llm,
        });
    }

    // Calculate an overall score based on the ranking criteria
    implementations.forEach(impl => {
        let score = 0;
        let maxPossibleScore = 0;

        // Weight criteria based on ranking position (higher rank = higher weight)
        rankedCriteria.forEach((criterion, index) => {
            const weight = rankedCriteria.length - index;
            score += (impl.criteriaScores[criterion] || 7) * weight;
            maxPossibleScore += 10 * weight; // 10 is max score
        });

        // If no criteria selected, use a simple average
        if (rankedCriteria.length === 0) {
            score = Object.values(impl.criteriaScores).reduce((a, b) => a + b, 0);
            maxPossibleScore = Object.values(impl.criteriaScores).length * 10;
        }

        impl.overallScore = Math.round((score / maxPossibleScore) * 100);
    });

    // Sort by overall score (descending)
    implementations.sort((a, b) => b.overallScore - a.overallScore);

    // Assign final ranks after sorting
    implementations.forEach((impl, idx) => {
        impl.rank = idx + 1;
    });

    return {
        bestImplementation: implementations[0],
        otherImplementations: implementations.slice(1),
    };
};

export default generateMockResponse;