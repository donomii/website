#include <stdio.h>
#include <stdlib.h>
#include <assert.h>

typedef struct TreeNodeStruct { 
	struct TreeNodeStruct* parent;
} TreeNode;

/*Return the length of the linked list*/
int branchLength ( TreeNode* A) {
	int lengthA;
	for (lengthA=1; A->parent!=NULL; A=A->parent) {
		lengthA++;
	}

	return lengthA;
}

/* Move along the linked list by <length> elements */
TreeNode* drop (TreeNode* T, int length) {
	int i;

	for (i=0; i<length; i++) {
		T=T->parent;
	}

	return T;
}

/* Take two leaf nodes, traverse towards the root node until we find a common node (if any) */
TreeNode* findFirstCommonAncestor (TreeNode* A, TreeNode* B) {
	int lengthA,lengthB, diff;
	TreeNode* C;

	if (!(A&&B)){return NULL;}

	lengthA = branchLength(A);
	lengthB = branchLength(B);
	diff = lengthA-lengthB;

	if (diff>=0) {
		A=drop(A,diff);
	} else {
		B=drop(B,-diff);
	}
	for (A=A; A!=NULL; A=A->parent) {
		if (A==B) { return A;}
		B=B->parent;
	}

	

	return NULL;
}

/* Test function: Create a linked list to test our functions on */

TreeNode* makeBranch (TreeNode* parent, int length) {
	int i;
	TreeNode* t;
	TreeNode* prev_t = parent;

	for (i=0;i<length; i++) {
		t = (TreeNode*) calloc(1,sizeof(TreeNode));
		t->parent = prev_t;
		prev_t=t;
	}
	return t;
}

void test () {

	TreeNode* R = (TreeNode*) calloc(1,sizeof(TreeNode));
	TreeNode* Rbranch = makeBranch(R,200);
	TreeNode* A = makeBranch(NULL, 10);
	TreeNode* B = makeBranch(NULL, 5);
	TreeNode* C = makeBranch(R, 10);
	TreeNode* D = makeBranch(R, 5);
	TreeNode* E = makeBranch(Rbranch, 1000);
	TreeNode* F = makeBranch(Rbranch, 500);

	int i;
	for (i=0; i<1000000; i++) {

		//Check we handle NULL correctly
		TreeNode* res = findFirstCommonAncestor(NULL, NULL);
		assert(res==NULL);
		
		//Check branches from different trees (no common root)
		res = findFirstCommonAncestor(A,B);
		assert(res==NULL);

		//Check branches are separate up to the tree root
		res = findFirstCommonAncestor(C,D);
		assert(res==R);

		//Check degenerate case
		res = findFirstCommonAncestor(R,R);
		assert(res==R);

		//Check a real case
		res = findFirstCommonAncestor(E,F);
		assert(res==Rbranch);

		//Check branchLength(B)>branchLength(A)
		res = findFirstCommonAncestor(F,E);
		assert(res==Rbranch);
	}
}


int main(int argc, char* argv[])
{
		test();
}
