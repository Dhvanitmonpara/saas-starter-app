import { NextRequest, NextResponse } from "next/server";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const ITEMS_PER_PAGE = 10;

// Helper function to check if the user is an admin
async function isAdmin(userId: string) {
  try {

    if(!userId){
      return false
    }

    const client = await clerkClient();
    const user = (await client.users.getUser(userId)) || null;
    if (!user) {
      return false;
    }
    return user.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return false;
  }
}

// GET: Fetch user data with todos and pagination
export async function GET(req: NextRequest) {
  const { userId } = getAuth(req); // Newer getAuth method

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const page = parseInt(searchParams.get("page") || "1");

  try {
    const user = await prisma.user.findUnique({
      where: { email: email || "" },
      include: {
        todos: {
          orderBy: { createdAt: "desc" },
          take: ITEMS_PER_PAGE,
          skip: (page - 1) * ITEMS_PER_PAGE,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ user: null, totalPages: 0, currentPage: 1 });
    }

    const totalTodos = await prisma.todo.count({
      where: { userId: user.id },
    });

    const totalPages = Math.ceil(totalTodos / ITEMS_PER_PAGE);

    return NextResponse.json({
      user,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PUT: Update todo or user subscription
export async function PUT(req: NextRequest) {
  const { userId } = getAuth(req); // Newer getAuth method

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, todoId, todoCompleted, isSubscribed } = await req.json();

    if (todoId !== undefined && todoCompleted !== undefined) {
      // Update todo
      const updatedTodo = await prisma.todo.update({
        where: { id: todoId },
        data: { completed: todoCompleted },
      });
      return NextResponse.json(updatedTodo);
    } else if (isSubscribed !== undefined) {
      // Update user subscription
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          isSubscribed,
          subscriptionEnds: isSubscribed
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            : null,
        },
      });
      return NextResponse.json(updatedUser);
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a todo
export async function DELETE(req: NextRequest) {
  const { userId } = getAuth(req); // Newer getAuth method

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { todoId } = await req.json();

    await prisma.todo.delete({
      where: { id: todoId },
    });

    return NextResponse.json({ message: "Todo deleted successfully" });
  } catch (error) {
    console.error("Error deleting todo:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
