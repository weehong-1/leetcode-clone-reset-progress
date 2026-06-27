import { Types } from "mongoose";
import type { JudgeResult, Submission } from "@shared";
import { type ISubmission, SubmissionModel } from "../models/submission.model";

/** Shape returned by `.lean()` reads — the document fields plus its `_id`. */
type LeanSubmission = ISubmission & { _id: Types.ObjectId };

/** Map a persisted document to the client-facing DTO. */
function toDto(doc: LeanSubmission): Submission {
	return {
		id: doc._id.toString(),
		titleSlug: doc.titleSlug,
		submissionId: doc.submissionId ?? null,
		source: doc.source,
		lang: doc.lang,
		code: doc.code,
		name: doc.name ?? null,
		note: doc.note ?? null,
		statusMsg: doc.statusMsg ?? null,
		accepted: doc.accepted,
		runtimeMs: doc.runtimeMs ?? null,
		memoryKb: doc.memoryKb ?? null,
		totalCorrect: doc.totalCorrect ?? null,
		totalTestcases: doc.totalTestcases ?? null,
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
	};
}

export interface SaveJudgedInput {
	slug: string;
	lang: string;
	code: string;
	result: JudgeResult;
}

/**
 * Persist a judged Submit. Best-effort: never throws, so a DB outage cannot
 * break the submit response. Upserts on `submissionId` to avoid duplicates if
 * the same submission is judged more than once.
 */
export async function saveJudgedSubmission(input: SaveJudgedInput): Promise<void> {
	const { slug, lang, code, result } = input;
	try {
		await SubmissionModel.updateOne(
			{ submissionId: result.submissionId },
			{
				$set: {
					titleSlug: slug,
					submissionId: result.submissionId,
					source: "submit",
					lang,
					code,
					statusMsg: result.statusMsg,
					accepted: result.accepted,
					runtimeMs: result.runtimeMs,
					memoryKb: result.memoryKb,
					totalCorrect: result.totalCorrect,
					totalTestcases: result.totalTestcases,
				},
			},
			{ upsert: true }
		);
	} catch (error) {
		console.error("Failed to persist submission (continuing):", error);
	}
}

export interface CreateSnapshotInput {
	slug: string;
	lang: string;
	code: string;
	name?: string;
	note?: string;
}

/** Save the current editor code as a named approach, without judging it. */
export async function createSnapshot(
	input: CreateSnapshotInput
): Promise<Submission> {
	const created = await SubmissionModel.create({
		titleSlug: input.slug,
		submissionId: null,
		source: "snapshot",
		lang: input.lang,
		code: input.code,
		name: input.name ?? null,
		note: input.note ?? null,
		accepted: false,
	});
	return toDto(created.toObject() as LeanSubmission);
}

/** A problem's full history, newest first. */
export async function listSubmissions(slug: string): Promise<Array<Submission>> {
	const docs = await SubmissionModel.find({ titleSlug: slug })
		.sort({ createdAt: -1 })
		.lean<Array<LeanSubmission>>()
		.exec();
	return docs.map(toDto);
}

export interface UpdateSubmissionInput {
	name?: string;
	note?: string;
}

/** Edit an entry's name/note. Returns null when the id does not exist. */
export async function updateSubmission(
	id: string,
	input: UpdateSubmissionInput
): Promise<Submission | null> {
	const update: Partial<Pick<ISubmission, "name" | "note">> = {};
	if (input.name !== undefined) update.name = input.name;
	if (input.note !== undefined) update.note = input.note;

	const doc = await SubmissionModel.findByIdAndUpdate(id, update, { new: true })
		.lean<LeanSubmission>()
		.exec();
	return doc ? toDto(doc) : null;
}

/** Delete an entry. Returns false when the id does not exist. */
export async function deleteSubmission(id: string): Promise<boolean> {
	const result = await SubmissionModel.deleteOne({ _id: id }).exec();
	return result.deletedCount > 0;
}
