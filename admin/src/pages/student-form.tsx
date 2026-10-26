import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { FormPageSkeleton } from '@/components/loading-skeletons';
import { ApiError } from '@/lib/api-client';
import { SaveButton } from '@/components/save-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { canMutateOrg } from '@/lib/access';
import { createStudent, getStudent, updateStudent } from '@/services';

export function StudentFormPage({ mode }: { mode: 'create' | 'edit' | 'view' }) {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const canEdit = canMutateOrg(auth.status === 'authenticated' ? auth.membership : null);
  const readOnly = mode === 'view';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [cohort, setCohort] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(!readOnly && dirty);

  useEffect(() => {
    if (mode === 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const student = await getStudent(studentId);
        if (cancelled) return;
        setName(student.name);
        setEmail(student.email);
        setPhone(student.phone === '—' ? '' : student.phone);
        setCourse(student.course === '—' ? '' : student.course);
        setCity(student.city === '—' ? '' : student.city);
        setCohort(student.cohort === '—' ? '' : student.cohort);
        setCode(student.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load student.');
        void navigate('/students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, navigate, studentId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        await createStudent({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          course: course.trim() || undefined,
          city: city.trim() || undefined,
          cohort: cohort.trim() || undefined,
          code: code.trim() || undefined,
        });
        toast.success('Student created.');
      } else {
        await updateStudent(studentId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          course: course.trim() || null,
          city: city.trim() || null,
          cohort: cohort.trim() || null,
        });
        toast.success('Student updated.');
      }
      allowLeave();
      void navigate('/students');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save student.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <FormPageSkeleton fields={6} />;
  }

  const title =
    mode === 'create' ? 'Add Student' : mode === 'edit' ? 'Edit Student' : 'View Student';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-1">
            <Link to="/students">
              <ArrowLeftIcon data-icon="inline-start" /> Back to students
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly
              ? 'Student profile (read-only).'
              : 'Changes are saved to the organization database.'}
          </p>
        </div>
        {mode === 'view' && canEdit ? (
          <Button asChild>
            <Link to={`/students/${studentId}/edit`}>Edit</Link>
          </Button>
        ) : null}
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Student information</CardTitle>
          <CardDescription>
            {readOnly
              ? 'Details for this student.'
              : 'Required fields must be completed before saving.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit} onChange={() => setDirty(true)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="student-name">
                  Full name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="student-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={readOnly}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="student-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={readOnly}
                />
              </Field>
              {(mode === 'create' || mode === 'view' || mode === 'edit') && (
                <Field>
                  <FieldLabel htmlFor="student-code">Unique ID</FieldLabel>
                  <Input
                    id="student-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Auto-generated if blank"
                    disabled={mode !== 'create'}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="student-phone">Phone</FieldLabel>
                <Input
                  id="student-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-course">Course</FieldLabel>
                <Input
                  id="student-course"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-city">City</FieldLabel>
                <Input
                  id="student-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-cohort">Cohort</FieldLabel>
                <Input
                  id="student-cohort"
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                  disabled={readOnly}
                  placeholder="e.g. Alpha"
                />
              </Field>
              {!readOnly ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate('/students')}
                  >
                    Cancel
                  </Button>
                  <SaveButton pending={saving}>
                    {mode === 'create' ? 'Create student' : 'Save changes'}
                  </SaveButton>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
