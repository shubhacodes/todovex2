import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

import OpenAI from "openai";
import { Id } from "./_generated/dataModel";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' })."
  );
}

const openai = new OpenAI({ apiKey });

export const suggestMissingItemsWithAi = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    try {
      // Retrieve todos for the user
      const todos = await ctx.runQuery(api.todos.getTodosByProjectId, {
        projectId,
      });

      const project = await ctx.runQuery(api.projects.getProjectByProjectId, {
        projectId,
      });
      const projectName = project?.name || "";

      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "I'm a project manager and I need help identifying missing to-do items. I have a list of existing tasks in JSON format, containing objects with 'taskName' and 'description' properties. I also have a good understanding of the project scope. Can you help me identify 5 additional to-do items for the project with projectName that are not yet included in this list? Please provide these missing items in a separate JSON array with the key 'todos' containing objects with 'taskName' and 'description' properties. Ensure there are no duplicates between the existing list and the new suggestions.",
          },
          {
            role: "user",
            content: JSON.stringify({
              todos,
              projectName,
            }),
          },
        ],
        model: "gpt-3.5-turbo",
      });

      const messageContent = response.choices[0].message?.content;
      console.log({ messageContent });

      // Create the todos
      if (messageContent) {
        const items = JSON.parse(messageContent)?.todos ?? [];
        const AI_LABEL_ID = "k57exc6xrw3ar5e1nmab4vnbjs6v1m4p";

        for (const item of items) {
          const { taskName, description } = item;
          const embedding = await getEmbeddingsWithAI(taskName);
          await ctx.runMutation(api.todos.createATodo, {
            taskName,
            description,
            priority: 1,
            dueDate: new Date().getTime(),
            projectId,
            labelId: AI_LABEL_ID as Id<"labels">,
            embedding,
          });
        }
      }
    } catch (error) {
      console.error("Error in suggestMissingItemsWithAi:", error);
      throw error;
    }
  },
});

export const suggestMissingSubItemsWithAi = action({
  args: {
    projectId: v.id("projects"),
    parentId: v.id("todos"),
    taskName: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { projectId, parentId, taskName, description }) => {
    try {
      // Retrieve todos for the user
      const todos = await ctx.runQuery(api.subTodos.getSubTodosByParentId, {
        parentId,
      });

      const project = await ctx.runQuery(api.projects.getProjectByProjectId, {
        projectId,
      });
      const projectName = project?.name || "";

      const response = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "I'm a project manager and I need help identifying missing sub tasks for a parent todo. I have a list of existing sub tasks in JSON format, containing objects with 'taskName' and 'description' properties. I also have a good understanding of the project scope. Can you help me identify 2 additional sub tasks that are not yet included in this list? Please provide these missing items in a separate JSON array with the key 'todos' containing objects with 'taskName' and 'description' properties. Ensure there are no duplicates between the existing list and the new suggestions.",
          },
          {
            role: "user",
            content: JSON.stringify({
              todos,
              projectName,
              ...{ parentTodo: { taskName, description } },
            }),
          },
        ],
        model: "gpt-3.5-turbo",
      });

      const messageContent = response.choices[0].message?.content;
      console.log({ messageContent });

      // Create the todos
      if (messageContent) {
        const items = JSON.parse(messageContent)?.todos ?? [];
        const AI_LABEL_ID = "k57exc6xrw3ar5e1nmab4vnbjs6v1m4p";

        for (const item of items) {
          const { taskName, description } = item;
          const embedding = await getEmbeddingsWithAI(taskName);
          await ctx.runMutation(api.subTodos.createASubTodo, {
            taskName,
            description,
            priority: 1,
            dueDate: new Date().getTime(),
            projectId,
            parentId,
            labelId: AI_LABEL_ID as Id<"labels">,
            embedding,
          });
        }
      }
    } catch (error) {
      console.error("Error in suggestMissingSubItemsWithAi:", error);
      throw error;
    }
  },
});

export const getEmbeddingsWithAI = async (searchText: string) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key is not defined");
  }

  const req = {
    input: searchText,
    model: "text-embedding-ada-002",
  };

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`OpenAI Error: ${msg}`);
    }

    const json = await response.json();
    const vector = json.data[0].embedding;

    console.log(`Embedding of ${searchText}: ${vector.length} dimensions`);
    return vector;
  } catch (error) {
    console.error("Failed to fetch embedding from OpenAI API:", error);
    throw error;
  }
};
