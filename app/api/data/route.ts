import { NextRequest, NextResponse } from 'next/server';

const REPO_OWNER = 'kushXpai';
const REPO_NAME = 'autoriders-fleet-data';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

// GET — list all .xlsx files, optionally filtered by branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'branch';
    const branch = searchParams.get('branch') || '';

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ files: [] });
      return NextResponse.json({ error: 'Failed to fetch repo contents' }, { status: res.status });
    }

    const contents = await res.json();
    let xlsxFiles = Array.isArray(contents)
      ? contents.filter((f: { name: string }) => f.name.endsWith('.xlsx'))
      : [];

    // Branch users can only see their own branch files
    if (role === 'branch' && branch) {
      const branchLower = branch.toLowerCase();
      xlsxFiles = xlsxFiles.filter((f: { name: string }) => {
        const nameLower = f.name.toLowerCase();
        return nameLower.startsWith(branchLower + ' ') || nameLower.startsWith(branchLower + '-');
      });
    }

    const files = xlsxFiles.map((f: { name: string; sha: string; download_url: string }) => ({
      name: f.name,
      sha: f.sha,
      download_url: f.download_url,
    }));

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to GitHub' }, { status: 500 });
  }
}

// POST — upload/update an xlsx file
export async function POST(req: NextRequest) {
  try {
    const { filename, content, username } = await req.json();

    if (!filename || !content || !username) {
      return NextResponse.json({ error: 'Missing filename, content, or username' }, { status: 400 });
    }

    // Check if file already exists to get its SHA
    let sha: string | undefined;
    let commitVerb = 'Add';
    const checkRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filename)}`,
      { headers, cache: 'no-store' }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
      commitVerb = 'Update';
    }

    const monthYear = filename.replace('.xlsx', '');
    const message = `${commitVerb}: ${monthYear} by ${username}`;

    const body: Record<string, string> = { message, content };
    if (sha) body.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filename)}`,
      { method: 'PUT', headers, body: JSON.stringify(body) }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return NextResponse.json({ error: err.message || 'Upload failed' }, { status: putRes.status });
    }

    return NextResponse.json({ success: true, action: commitVerb });
  } catch {
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}

// DELETE — remove a file from repo
export async function DELETE(req: NextRequest) {
  try {
    const { filename, username } = await req.json();

    if (!filename || !username) {
      return NextResponse.json({ error: 'Missing filename or username' }, { status: 400 });
    }

    const checkRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filename)}`,
      { headers, cache: 'no-store' }
    );
    if (!checkRes.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const existing = await checkRes.json();

    const monthYear = filename.replace('.xlsx', '');
    const message = `Remove: ${monthYear} by ${username}`;

    const delRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ message, sha: existing.sha }),
      }
    );

    if (!delRes.ok) {
      const err = await delRes.json();
      return NextResponse.json({ error: err.message || 'Delete failed' }, { status: delRes.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
