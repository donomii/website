#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include "utlist.h"

#define maxTables  100
#define maxCustomers 100000
#define log //printf  //Uncomment  printf to print debug messages

typedef void* pointer;

typedef struct Table {
	char	name[20];
	int	size;
	int	vacant;
} Table;

enum counters_enum {
	ARRIVED,
	ENQUEUED,
	QUEUE_SCANS,
	QUEUE_HOPS,
	PERFECT_FIT,
	NOT_PERFECT_FIT,
	MAX_QUEUE_LENGTH,
	LEFT_WITHOUT_BEING_SEATED,
	LEFT_FROM_TABLE,
	QUEUE_TO_TABLE
};
int counter[20]; //Collect some statistics

typedef  struct CustomerGroup {
	int 	id;
	int 	size;
	Table*	table;
	struct CustomerGroup *next, *prev;
} CustomerGroup;
struct CustomerGroup* customers= NULL;
CustomerGroup* customerPool[maxCustomers];

Table* tables[7][maxTables];  	//We could have almost all the tables end up in queue 2
CustomerGroup *waiting = NULL;  	//The groups-waiting queue
int maxTableSize=6;
int queue_length=0;

int lastTable[7];			//Pointer to the last free table in free list
int initted = 0;			//Safety check that data structure have been initialised.






/* Seat a group, either at a table or on the waiting list */ 
void arrives(CustomerGroup* aGroup) {
	int i;
	assert(initted);
	
	log("Seating group of size %d\n", aGroup->size);
	int tablesize = canSeat(aGroup);
	assert(tablesize<maxTableSize+1);
	log("canSeat recommends a table of size %d, and there are %d tables of size %d free.\n", tablesize, lastTable[tablesize], tablesize);
	if(tablesize) {
		if (tablesize == aGroup->size) {
			aGroup->table = tables[aGroup->size][lastTable[aGroup->size]--];
			aGroup->table->vacant-=aGroup->size;
			counter[PERFECT_FIT]++;		
			log("Assigned group %d of size %d to table %s, vacant seats: %d, lastTable: %d\n", aGroup->id, aGroup->size, aGroup->table->name, aGroup->table->vacant, lastTable[aGroup->size]);
		} else {
			aGroup->table = tables[tablesize][lastTable[tablesize]--];
			aGroup->table->vacant-=aGroup->size;
			log("Assigned group %d to table %s, vacant seats: %d, lastTable: %d\n", aGroup->id,  aGroup->table->name, aGroup->table->vacant, lastTable[tablesize]);
			counter[NOT_PERFECT_FIT]++;
			return;
		}
	} else {
		//We're out of tables, add the customer group to the queue
		log("Adding customers to wait queue\n");
		DL_APPEND(waiting, aGroup);
		counter[ENQUEUED]++;
		queue_length++;
		counter[MAX_QUEUE_LENGTH]=(queue_length)>counter[MAX_QUEUE_LENGTH]?queue_length:counter[MAX_QUEUE_LENGTH];
	}
	log("arrived: %d, fit: %d, partial fit: %d, queue_length %d\n", counter[ARRIVED], counter[PERFECT_FIT] , counter[NOT_PERFECT_FIT] , queue_length);
	assert(counter[ARRIVED] == counter[PERFECT_FIT] + counter[NOT_PERFECT_FIT] + queue_length+counter[LEFT_WITHOUT_BEING_SEATED]);
	
}

CustomerGroup* scanForMaxSize(CustomerGroup* aList,int size) {
	counter[QUEUE_SCANS]++;
	for (aList=aList->next;aList;aList=aList->next) {
		counter[QUEUE_HOPS]++;
		if (aList->size<=size) { return aList;}
	}
	return NULL;
}

/* Check the free lists to see if there are any tables, at all, that can hold the group */
int canSeat (CustomerGroup* aGroup) {
	int i;
	log("Checking if we can seat group %d of size %d\n", aGroup->id, aGroup->size);
	if(lastTable[aGroup->size]<1) {
		log("Attempting to seat group at a larger table\n");
		if (aGroup->size<maxTableSize) {
			//Maybe we can fit the group at a bigger table
			for (i=aGroup->size; i<maxTableSize+1;i++) {
				if (lastTable[i]>0) return i;
			}
		}
	} else {
		return aGroup->size;
	}
	return 0;
}

/* See if we can seat any groups from the waiting list.  Groups can "jump the queue" if they are smaller than the groups in front */
void reSeat() {
	int i;
	CustomerGroup* candidate;
	if(queue_length) {
		//Attempt to seat the first group on the list
		counter[QUEUE_SCANS]++;
		for (candidate=waiting;candidate;candidate=candidate->next) {
			counter[QUEUE_HOPS]++;
			if(canSeat(candidate)) {
				queue_length--;
				DL_DELETE(waiting, candidate);
				arrives(candidate);
				counter[QUEUE_TO_TABLE]++;
				return;
			}
			
		}

	}
}

/* A group leaves their table (or the waiting list - NOT GOOD).  Adjust the lists appropriately */
void leaves(CustomerGroup* aGroup) {
	assert(initted);
	if(aGroup->table) {
		//If the party was seated
		log("Removing group %d from table %s(%d), next: %d, prev: %d\n", aGroup->id,   aGroup->table->name, aGroup->table, aGroup->next, aGroup->prev);
		aGroup->table->vacant+=aGroup->size;
		tables[aGroup->table->vacant][++lastTable[aGroup->table->vacant]]=aGroup->table;
		aGroup->table=NULL;
		//Now we have an empty table, let's try to reseat someone from the queue
		reSeat();
		counter[LEFT_FROM_TABLE]++;
	} else {
		//They are still in the queue
		log("Removing group of size %d from queue, next: %d, prev: %d\n", aGroup->size, aGroup->next, aGroup->prev);
		DL_DELETE(waiting,aGroup);
		queue_length--;
		counter[LEFT_WITHOUT_BEING_SEATED]++;
		assert(queue_length>=0);
	}
	log("Queue length: %d\n", queue_length);
}

/* Returns the table that a group is seated at */
/* I chose to modify the customer data structure to add a table value, so finding the table is trivial.  If I couldn't alter the data structure, I could always just wrap the customer struct in a new struct to keep track of data.  I think both these solutions are better than yet another list to track groups->tables. */
Table* locate(CustomerGroup* aGroup){
	assert(initted);
	return aGroup->table;

}


/* Make sure it all works (it didn't the first time!).  Create a lot of customer groups (customers), have them all arrive at the restaurant, then leave. */
int test (int customers) {
	int i;
	int leaveGroup = 0;
	for (i=0;i<customers/2;i++) {
		counter[ARRIVED]++;
		CustomerGroup* testGroup =(CustomerGroup*)calloc(1, sizeof(CustomerGroup));
		testGroup->size = rand()%6+1;
		testGroup->id = i;
		customerPool[i] = testGroup;
		/* Group arrives at restaurant */
		log("Customer group %d is arriving...\n", i);
		arrives(testGroup);
		assert(customerPool[0]->table);
	}
	
	/* Simulate churn - one group leaves, another group arrives */
	for (i=customers/2;i<customers;i++) {
		counter[ARRIVED]++;
		CustomerGroup* testGroup =(CustomerGroup*)calloc(1, sizeof(CustomerGroup));
		testGroup->size = rand()%6+1;
		testGroup->id = i;
		customerPool[i] = testGroup;
		
		/* Group arrives at restaurant */
		arrives(testGroup);
		
		
		/* Another group leaves */
		log("Customer group %d is leaving...\n", leaveGroup);
		leaves(customerPool[leaveGroup]);
		free(customerPool[leaveGroup]);
		leaveGroup++;
	}
	
	/* Customers leave */
	while (leaveGroup<customers) {
		log("Customer group %d is leaving...\n", leaveGroup);
		leaves(customerPool[leaveGroup]);
		free(customerPool[leaveGroup]);
		leaveGroup++;
	}
}

/* Allocate structures */
void init() {
	int i,t;
	srand(time(NULL));
	for(t=2;t<7;t++) {
		for (i=1; i<maxTables; i++) {
			tables[t][i]=(Table*)calloc(1,sizeof(Table));;
			tables[t][i]->size=t;
			tables[t][i]->vacant=t;
			snprintf(tables[t][i]->name, 19, "%d-%d", t, i);
		}
		lastTable[t]=maxTables-1;
	}
	initted=1;
}


int main(int argc, char* argv[])
{
	init();
	test(90000);
	/* At first my implementation didn't work, so I started added debugging information to track what was going on.  It made a nice summary */
	printf("%d groups arrived.  Seated %d groups at a table of the same size, and %d at a larger table than was necessary.  %d groups had to wait in queue, and the maximum queue length was %d.  %d moved from the queue to a table.  %d queue scans performed, visiting %d list elements in total, for an average of %d items per scan.  %d groups left without being seated, %d left from a table.\n", counter[ARRIVED], counter[PERFECT_FIT], counter[NOT_PERFECT_FIT], counter[ENQUEUED], counter[MAX_QUEUE_LENGTH], counter[QUEUE_TO_TABLE], counter[QUEUE_SCANS], counter[QUEUE_HOPS],  counter[QUEUE_HOPS]/(1+counter[QUEUE_SCANS]), counter[LEFT_WITHOUT_BEING_SEATED], counter[LEFT_FROM_TABLE]);
}

