#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
typedef void* pointer;
typedef struct TreeNodeStruct { 
	struct TreeNodeStruct* parent;
} TreeNode;

typedef struct cons {
	pointer car;
	struct cons* cdr;
} cons;

/* Traverse two lists pariwise, checking that the elements in both lists are the same.  Stop at the last element for which this is true. */
TreeNode* findLastMatchingElement (cons* A, cons* B) {
	if ((!A->cdr)||(!B->cdr)) { return NULL;}
	if ((!A->cdr->cdr)||(!B->cdr->cdr)) { return A->car;}
	if (A->cdr->car == B->cdr->car) {
		return findLastMatchingElement(A->cdr, B->cdr);
	} else {
		return A->car;
	}
}

/* Traverse two lists to find the common tail (the common ancestor in this tree structure. */
TreeNode* findFirstCommonAncestorRec (TreeNode* A, TreeNode* B, cons* reverseA, cons* reverseB) {
	cons rA = { A, reverseA};
	cons rB = { B, reverseB};
	if (A||B) {
		return findFirstCommonAncestorRec(A?A->parent:A, B?B->parent:B, A?&rA:reverseA, B?&rB:reverseB);
	} else {
		if (!(reverseA->car==reverseB->car)) {
			//The branches have no common root!
			return NULL;
		} else {
			return findLastMatchingElement(reverseA,reverseB);
		}
	}
}

/* Take two leaf nodes, traverse towards the root node until we find a common node (if any) */
TreeNode* findFirstCommonAncestor (TreeNode* A, TreeNode* B) {
	cons rA = {NULL, NULL};
	cons rB = {NULL, NULL};

	return findFirstCommonAncestorRec(A, B, &rA, &rB);
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

		//R is the root not of the tree
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
